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

/** Tier limits — crawls are always unlimited, pages per crawl is the value lever */
export const TIER_LIMITS = {
  GUEST:      { pagesPerCrawl: 500,    projects: 1,  aiQueriesPerDay: 5,   competitors: false, jsRendering: false, teamMembers: 1,  whiteLabel: false },
  STARTER:    { pagesPerCrawl: 10000,  projects: 3,  aiQueriesPerDay: 25,  competitors: true,  jsRendering: false, teamMembers: 1,  whiteLabel: false },
  PRO:        { pagesPerCrawl: 50000,  projects: -1, aiQueriesPerDay: -1,  competitors: true,  jsRendering: true,  teamMembers: 5,  whiteLabel: false },
  ENTERPRISE: { pagesPerCrawl: -1,     projects: -1, aiQueriesPerDay: -1,  competitors: true,  jsRendering: true,  teamMembers: -1, whiteLabel: true  },
} as const; // -1 = unlimited

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Create a guest account instantly — no email or password needed.
   * Unlimited crawls, 500 pages per crawl, 1 project.
   */
  async createGuest() {
    const guestId = randomUUID().slice(0, 8);
    const email = `guest-${guestId}@hydrafrog.local`;
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const user = await this.prisma.user.create({
      data: { email, passwordHash, tier: 'GUEST' },
    });

    const org = await this.prisma.org.create({
      data: {
        name: 'Guest Workspace',
        members: { create: { userId: user.id, role: 'ADMIN' } },
        projects: {
          create: {
            name: 'Sample Project',
            domain: 'example.com',
            startUrl: 'https://example.com',
            settingsJson: { maxPages: TIER_LIMITS.GUEST.pagesPerCrawl, crawlDelay: 1000, respectRobotsTxt: true },
          },
        },
      },
    });

    return {
      accessToken: this.generateToken(user.id, email),
      user: { id: user.id, email, tier: 'GUEST', createdAt: user.createdAt },
      org: { id: org.id, name: org.name },
    };
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, tier: 'STARTER' },
    });

    const orgName = dto.email.split('@')[0] + "'s Organization";
    const org = await this.prisma.org.create({
      data: {
        name: orgName,
        members: { create: { userId: user.id, role: 'ADMIN' } },
        projects: {
          create: {
            name: 'My First Project',
            domain: 'example.com',
            startUrl: 'https://example.com',
            settingsJson: { maxPages: TIER_LIMITS.STARTER.pagesPerCrawl, crawlDelay: 1000, respectRobotsTxt: true },
          },
        },
      },
    });

    return {
      accessToken: this.generateToken(user.id, user.email),
      user: { id: user.id, email: user.email, tier: 'STARTER', createdAt: user.createdAt },
      org: { id: org.id, name: org.name },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      accessToken: this.generateToken(user.id, user.email),
      user: { id: user.id, email: user.email, tier: user.tier, createdAt: user.createdAt },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, tier: true, crawlsUsed: true, createdAt: true,
        orgMembers: {
          select: { role: true, org: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const limits = TIER_LIMITS[user.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.GUEST;

    return {
      ...user,
      limits: {
        pagesPerCrawl: limits.pagesPerCrawl,
        maxProjects: limits.projects,
        aiQueriesPerDay: limits.aiQueriesPerDay,
        competitors: limits.competitors,
        jsRendering: limits.jsRendering,
        teamMembers: limits.teamMembers,
        whiteLabel: limits.whiteLabel,
      },
    };
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email });
  }
}
