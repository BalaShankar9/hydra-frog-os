import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateOrgDto } from './dto/create-org.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrgRole } from '@prisma/client';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all orgs where the user is a member
   */
  async listOrgsForUser(userId: string) {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId },
      include: {
        org: {
          include: {
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      role: m.role,
      createdAt: m.org.createdAt,
      memberCount: m.org._count.members,
      projectCount: m.org._count.projects,
    }));
  }

  /**
   * Create a new organization and add the creator as ADMIN
   */
  async createOrg(userId: string, dto: CreateOrgDto) {
    const org = await this.prisma.org.create({
      data: {
        name: dto.name,
        members: {
          create: {
            userId,
            role: OrgRole.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });

    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      members: org.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        email: m.user.email,
        role: m.role,
      })),
    };
  }

  /**
   * Get an org by ID - throws if not found
   */
  async getOrgById(orgId: string) {
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Get member's role in an org, or null if not a member
   */
  async getMemberRole(userId: string, orgId: string): Promise<OrgRole | null> {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: { orgId, userId },
      },
    });

    return membership?.role ?? null;
  }

  /**
   * Assert that user is a member of the org - throws 403 if not
   */
  async assertOrgMember(userId: string, orgId: string): Promise<OrgRole> {
    // First check if org exists
    await this.getOrgById(orgId);

    const role = await this.getMemberRole(userId, orgId);
    if (!role) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return role;
  }

  /**
   * Assert that user is an ADMIN of the org - throws 403 if not
   */
  async assertOrgAdmin(userId: string, orgId: string): Promise<void> {
    const role = await this.assertOrgMember(userId, orgId);
    if (role !== OrgRole.ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }

  /**
   * List all members of an organization
   */
  async listMembers(orgId: string) {
    const members = await this.prisma.orgMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, email: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Add a member to an organization
   */
  async addMember(orgId: string, dto: AddMemberDto) {
    // Find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existingMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: { orgId, userId: user.id },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Add the member
    const member = await this.prisma.orgMember.create({
      data: {
        orgId,
        userId: user.id,
        role: dto.role,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    return {
      id: member.id,
      userId: member.user.id,
      email: member.user.email,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }
}
