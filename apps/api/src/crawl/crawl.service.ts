import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { QueueService } from '../queue';
import { CrawlRunStatus, OrgRole, Prisma } from '@prisma/client';

@Injectable()
export class CrawlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Get a project and verify user has access
   */
  private async getProjectWithAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify user is a member of the org
    const role = await this.orgService.assertOrgMember(userId, project.orgId);

    return { project, role };
  }

  /**
   * Verify user can write (run/cancel) - ADMIN or MEMBER only
   */
  private assertCanWrite(role: OrgRole) {
    if (role === OrgRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot run or cancel crawls');
    }
  }

  /**
   * Start a new crawl run
   */
  async runNow(userId: string, projectId: string) {
    const { project, role } = await this.getProjectWithAccess(userId, projectId);
    this.assertCanWrite(role);

    // Check for concurrent runs
    const existingRun = await this.prisma.crawlRun.findFirst({
      where: {
        projectId,
        status: { in: [CrawlRunStatus.QUEUED, CrawlRunStatus.RUNNING] },
      },
    });

    if (existingRun) {
      throw new ConflictException(
        `A crawl is already ${existingRun.status.toLowerCase()} for this project. Please wait or cancel it first.`,
      );
    }

    // Create the crawl run
    const crawlRun = await this.prisma.crawlRun.create({
      data: {
        projectId,
        status: CrawlRunStatus.QUEUED,
        settingsSnapshotJson: project.settingsJson as Prisma.InputJsonValue,
        totalsJson: {
          pagesCrawled: 0,
          issues: 0,
          startedBy: userId,
        } as Prisma.InputJsonValue,
      },
    });

    // Enqueue the job with crawlRunId as jobId for idempotency
    await this.queueService.addCrawlJob(
      'crawl',
      {
        crawlRunId: crawlRun.id,
        projectId,
      },
      {
        jobId: crawlRun.id, // Use crawlRunId as jobId for idempotency
      },
    );

    return {
      crawlRunId: crawlRun.id,
      status: crawlRun.status,
    };
  }

  /**
   * Cancel a crawl run
   */
  async cancel(userId: string, projectId: string, crawlRunId?: string) {
    const { role } = await this.getProjectWithAccess(userId, projectId);
    this.assertCanWrite(role);

    let crawlRun;

    if (crawlRunId) {
      // Cancel specific run
      crawlRun = await this.prisma.crawlRun.findUnique({
        where: { id: crawlRunId },
      });

      if (!crawlRun) {
        throw new NotFoundException('Crawl run not found');
      }

      if (crawlRun.projectId !== projectId) {
        throw new BadRequestException('Crawl run does not belong to this project');
      }
    } else {
      // Cancel latest QUEUED or RUNNING run
      crawlRun = await this.prisma.crawlRun.findFirst({
        where: {
          projectId,
          status: { in: [CrawlRunStatus.QUEUED, CrawlRunStatus.RUNNING] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!crawlRun) {
        throw new NotFoundException('No active crawl run to cancel');
      }
    }

    // Check if cancellable
    if (
      crawlRun.status === CrawlRunStatus.DONE ||
      crawlRun.status === CrawlRunStatus.FAILED ||
      crawlRun.status === CrawlRunStatus.CANCELED
    ) {
      throw new BadRequestException(
        `Cannot cancel a crawl run with status ${crawlRun.status}`,
      );
    }

    // If QUEUED, remove from queue
    if (crawlRun.status === CrawlRunStatus.QUEUED) {
      await this.queueService.removeJob(
        QueueService.CRAWL_JOBS_QUEUE,
        crawlRun.id,
      );
    }

    // Update status to CANCELED
    const updated = await this.prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: CrawlRunStatus.CANCELED,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      crawlRunId: updated.id,
      newStatus: updated.status,
    };
  }

  /**
   * List crawl runs for a project
   */
  async listCrawlRuns(userId: string, projectId: string) {
    await this.getProjectWithAccess(userId, projectId);

    const crawlRuns = await this.prisma.crawlRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        totalsJson: true,
      },
    });

    return crawlRuns;
  }

  /**
   * Get crawl run details
   */
  async getCrawlRun(userId: string, crawlRunId: string) {
    const crawlRun = await this.prisma.crawlRun.findUnique({
      where: { id: crawlRunId },
      include: {
        project: {
          select: { orgId: true },
        },
      },
    });

    if (!crawlRun) {
      throw new NotFoundException('Crawl run not found');
    }

    // Verify user is a member of the org
    await this.orgService.assertOrgMember(userId, crawlRun.project.orgId);

    return {
      id: crawlRun.id,
      projectId: crawlRun.projectId,
      status: crawlRun.status,
      startedAt: crawlRun.startedAt,
      finishedAt: crawlRun.finishedAt,
      totalsJson: crawlRun.totalsJson,
      settingsSnapshotJson: crawlRun.settingsSnapshotJson,
      createdAt: crawlRun.createdAt,
      updatedAt: crawlRun.updatedAt,
    };
  }

  /**
   * Check if a project has an active (QUEUED or RUNNING) crawl
   */
  async hasActiveCrawl(projectId: string): Promise<boolean> {
    const existingRun = await this.prisma.crawlRun.findFirst({
      where: {
        projectId,
        status: { in: [CrawlRunStatus.QUEUED, CrawlRunStatus.RUNNING] },
      },
    });
    return !!existingRun;
  }

  /**
   * Start a crawl run triggered by the scheduler (no permission checks)
   * Used internally by SchedulerService
   */
  async runScheduled(projectId: string): Promise<{ crawlRunId: string; status: string } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return null;
    }

    // Check for concurrent runs
    if (await this.hasActiveCrawl(projectId)) {
      return null; // Skip if there's already an active crawl
    }

    // Create the crawl run
    const crawlRun = await this.prisma.crawlRun.create({
      data: {
        projectId,
        status: CrawlRunStatus.QUEUED,
        settingsSnapshotJson: project.settingsJson as Prisma.InputJsonValue,
        totalsJson: {
          pagesCrawled: 0,
          issues: 0,
          startedBy: 'scheduler',
        } as Prisma.InputJsonValue,
      },
    });

    // Enqueue the job
    await this.queueService.addCrawlJob(
      'crawl',
      {
        crawlRunId: crawlRun.id,
        projectId,
      },
      {
        jobId: crawlRun.id,
      },
    );

    return {
      crawlRunId: crawlRun.id,
      status: crawlRun.status,
    };
  }
}
