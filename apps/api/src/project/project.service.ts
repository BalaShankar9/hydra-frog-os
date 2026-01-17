import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { OrgRole, Prisma } from '@prisma/client';

const DEFAULT_SETTINGS: Prisma.InputJsonValue = {
  maxDepth: 3,
  maxPages: 1000,
  respectRobots: true,
  crawlDelay: 100,
  userAgent: 'HydraFrogBot/1.0',
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  /**
   * List all projects in an organization
   */
  async listProjects(userId: string, orgId: string) {
    // Verify membership (any role can view)
    await this.orgService.assertOrgMember(userId, orgId);

    const projects = await this.prisma.project.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { crawlRuns: true },
        },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      orgId: p.orgId,
      name: p.name,
      domain: p.domain,
      startUrl: p.startUrl,
      settingsJson: p.settingsJson,
      crawlRunCount: p._count.crawlRuns,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, dto: CreateProjectDto) {
    // Only ADMIN or MEMBER can create
    const role = await this.orgService.assertOrgMember(userId, dto.orgId);
    if (role === OrgRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot create projects');
    }

    const project = await this.prisma.project.create({
      data: {
        orgId: dto.orgId,
        name: dto.name,
        domain: dto.domain,
        startUrl: dto.startUrl,
        settingsJson: (dto.settingsJson ?? DEFAULT_SETTINGS) as Prisma.InputJsonValue,
      },
    });

    return {
      id: project.id,
      orgId: project.orgId,
      name: project.name,
      domain: project.domain,
      startUrl: project.startUrl,
      settingsJson: project.settingsJson,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * Get a project by ID
   */
  async getProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { crawlRuns: true },
        },
        schedule: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify membership
    await this.orgService.assertOrgMember(userId, project.orgId);

    return {
      id: project.id,
      orgId: project.orgId,
      name: project.name,
      domain: project.domain,
      startUrl: project.startUrl,
      settingsJson: project.settingsJson,
      crawlRunCount: project._count.crawlRuns,
      schedule: project.schedule,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * Update a project
   */
  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only ADMIN or MEMBER can update
    const role = await this.orgService.assertOrgMember(userId, project.orgId);
    if (role === OrgRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot update projects');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.domain && { domain: dto.domain }),
        ...(dto.startUrl && { startUrl: dto.startUrl }),
        ...(dto.settingsJson && { settingsJson: dto.settingsJson as Prisma.InputJsonValue }),
      },
    });

    return {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      domain: updated.domain,
      startUrl: updated.startUrl,
      settingsJson: updated.settingsJson,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a project
   */
  async deleteProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only ADMIN can delete
    await this.orgService.assertOrgAdmin(userId, project.orgId);

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { deleted: true, id: projectId };
  }
}
