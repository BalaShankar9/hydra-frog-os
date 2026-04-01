import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto } from './dto';
import { randomUUID } from 'crypto';

/** Crawl limits per tier */
export const TIER_LIMITS = {
  GUEST: { crawls: 2, pagesPerCrawl: 100 },
  STARTER: { crawls: 10, pagesPerCrawl: 500 },
  PRO: { crawls: 100, pagesPerCrawl: 5000 },
  ENTERPRISE: { crawls: -1, pagesPerCrawl: 50000 }, // -1 = unlimited
} as const;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Create a guest account instantly — no email or password needed.
   * Gets 2 crawls to try the platform.
   */
  async createGuest() {
    const guestId = randomUUID().slice(0, 8);
    const email = `guest-${guestId}@hydrafrog.local`;
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        tier: 'GUEST',
        crawlsUsed: 0,
      },
    });

    const org = await this.prisma.org.create({
      data: {
        name: 'Guest Workspace',
        members: {
          create: { userId: user.id, role: 'ADMIN' },
        },
        projects: {
          create: {
            name: 'Sample Project',
            domain: 'example.com',
            startUrl: 'https://example.com',
            settingsJson: {
              maxPages: TIER_LIMITS.GUEST.pagesPerCrawl,
              crawlDelay: 1000,
              respectRobotsTxt: true,
            },
          },
        },
      },
    });

    const accessToken = this.generateToken(user.id, email);

    return {
      accessToken,
      user: { id: user.id, email, tier: 'GUEST', createdAt: user.createdAt },
      org: { id: org.id, name: org.name },
    };
  }

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        tier: 'STARTER',
        crawlsUsed: 0,
      },
    });

    const orgName = dto.email.split('@')[0] + "'s Organization";
    const org = await this.prisma.org.create({
      data: {
        name: orgName,
        members: {
          create: { userId: user.id, role: 'ADMIN' },
        },
        projects: {
          create: {
            name: 'My First Project',
            domain: 'example.com',
            startUrl: 'https://example.com',
            settingsJson: {
              maxPages: TIER_LIMITS.STARTER.pagesPerCrawl,
              crawlDelay: 1000,
              respectRobotsTxt: true,
            },
          },
        },
      },
    });

    const accessToken = this.generateToken(user.id, user.email);

    return {
      accessToken,
      user: { id: user.id, email: user.email, tier: 'STARTER', createdAt: user.createdAt },
      org: { id: org.id, name: org.name },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateToken(user.id, user.email);

    return {
      accessToken,
      user: { id: user.id, email: user.email, tier: user.tier, createdAt: user.createdAt },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tier: true,
        crawlsUsed: true,
        createdAt: true,
        orgMembers: {
          select: {
            role: true,
            org: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tierLimits = TIER_LIMITS[user.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.GUEST;

    return {
      ...user,
      limits: {
        crawlsAllowed: tierLimits.crawls,
        crawlsRemaining: tierLimits.crawls === -1 ? -1 : Math.max(0, tierLimits.crawls - user.crawlsUsed),
        pagesPerCrawl: tierLimits.pagesPerCrawl,
      },
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }
}
