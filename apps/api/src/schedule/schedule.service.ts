import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { ScheduleFrequency, OrgRole } from '@prisma/client';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  /**
   * Get project and verify user has access
   */
  private async getProjectWithAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.orgService.assertOrgMember(userId, project.orgId);
    return { project, role };
  }

  /**
   * Verify user can write (ADMIN or MEMBER only)
   */
  private assertCanWrite(role: OrgRole) {
    if (role === OrgRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot modify schedules');
    }
  }

  /**
   * Calculate nextRunAt based on frequency
   */
  private calculateNextRunAt(frequency: ScheduleFrequency): Date | null {
    const now = new Date();
    
    switch (frequency) {
      case ScheduleFrequency.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours
      case ScheduleFrequency.WEEKLY:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
      case ScheduleFrequency.MANUAL:
        return null; // No automatic scheduling
      default:
        return null;
    }
  }

  /**
   * Update or create schedule for a project
   */
  async updateSchedule(
    userId: string,
    projectId: string,
    enabled: boolean,
    frequency: ScheduleFrequency,
  ) {
    const { role } = await this.getProjectWithAccess(userId, projectId);
    this.assertCanWrite(role);

    const nextRunAt = enabled ? this.calculateNextRunAt(frequency) : null;

    const schedule = await this.prisma.crawlSchedule.upsert({
      where: { projectId },
      create: {
        projectId,
        enabled,
        frequency,
        nextRunAt,
      },
      update: {
        enabled,
        frequency,
        nextRunAt,
      },
    });

    return {
      projectId: schedule.projectId,
      enabled: schedule.enabled,
      frequency: schedule.frequency,
      nextRunAt: schedule.nextRunAt,
    };
  }

  /**
   * Get schedule for a project
   */
  async getSchedule(userId: string, projectId: string) {
    await this.getProjectWithAccess(userId, projectId);

    const schedule = await this.prisma.crawlSchedule.findUnique({
      where: { projectId },
    });

    if (!schedule) {
      // Return default if no schedule exists
      return {
        projectId,
        enabled: false,
        frequency: ScheduleFrequency.MANUAL,
        nextRunAt: null,
        lastRunAt: null,
      };
    }

    return {
      projectId: schedule.projectId,
      enabled: schedule.enabled,
      frequency: schedule.frequency,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
    };
  }

  /**
   * Update lastRunAt and compute nextRunAt after a scheduled run
   */
  async markScheduleRan(projectId: string) {
    const schedule = await this.prisma.crawlSchedule.findUnique({
      where: { projectId },
    });

    if (!schedule) return;

    const now = new Date();
    const nextRunAt = this.calculateNextRunAt(schedule.frequency);

    await this.prisma.crawlSchedule.update({
      where: { projectId },
      data: {
        lastRunAt: now,
        nextRunAt,
      },
    });
  }
}
