import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { CrawlService } from '../crawl';
import { ScheduleService } from './schedule.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlService: CrawlService,
    private readonly scheduleService: ScheduleService,
  ) {}

  /**
   * Runs every 60 seconds to check for due schedules
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCrawls() {
    // Prevent overlapping executions
    if (this.isRunning) {
      this.logger.debug('Scheduler already running, skipping...');
      return;
    }

    this.isRunning = true;
    const now = new Date();

    try {
      // Find all enabled schedules where nextRunAt <= now
      const dueSchedules = await this.prisma.crawlSchedule.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: now },
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (dueSchedules.length === 0) {
        return;
      }

      this.logger.log(`Found ${dueSchedules.length} due schedule(s) to process`);

      for (const schedule of dueSchedules) {
        try {
          await this.processDueSchedule(schedule);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Error processing schedule for project ${schedule.projectId}: ${err.message}`,
            err.stack,
          );
          // Continue processing other schedules
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Scheduler error: ${err.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single due schedule
   */
  private async processDueSchedule(schedule: {
    projectId: string;
    project: { id: string; name: string };
  }) {
    const { projectId, project } = schedule;

    // Check if there's already an active crawl (safety check)
    const hasActive = await this.crawlService.hasActiveCrawl(projectId);
    if (hasActive) {
      this.logger.debug(
        `Skipping scheduled crawl for project "${project.name}" (${projectId}) - active crawl exists`,
      );
      // Still update the schedule times so it doesn't retry every minute
      await this.scheduleService.markScheduleRan(projectId);
      return;
    }

    // Trigger the crawl
    this.logger.log(
      `Triggering scheduled crawl for project "${project.name}" (${projectId})`,
    );

    const result = await this.crawlService.runScheduled(projectId);

    if (result) {
      this.logger.log(
        `Scheduled crawl created: ${result.crawlRunId} for project "${project.name}"`,
      );
    } else {
      this.logger.warn(
        `Failed to create scheduled crawl for project "${project.name}" (${projectId})`,
      );
    }

    // Update lastRunAt and nextRunAt
    await this.scheduleService.markScheduleRan(projectId);
  }
}
