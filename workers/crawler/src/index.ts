import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma, disconnectPrisma } from './prisma.js';
import { logger } from './logger.js';
import { runCrawl } from './crawl/crawl-runner.js';
import { computeCrawlDiff } from './diff/computeCrawlDiff.js';
import { enqueueRenderJobs, closeRenderQueue } from './render/index.js';
import { startHealthServer } from '@hydra-frog-os/shared/health/index.js';

// Queue and job types
const QUEUE_NAME = 'crawl-jobs';

interface CrawlJobData {
  crawlRunId: string;
  projectId: string;
}

// Redis connection options
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const connectionOptions = {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
};

// Concurrency setting
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);

/**
 * Find the previous completed crawl run for a project
 */
async function findPreviousCompletedRun(
  projectId: string,
  currentRunId: string
): Promise<{ id: string } | null> {
  return prisma.crawlRun.findFirst({
    where: {
      projectId,
      status: 'DONE',
      id: { not: currentRunId },
    },
    orderBy: { finishedAt: 'desc' },
    select: { id: true },
  });
}

/**
 * Enqueue render jobs after crawl completes
 * Updates totalsJson with render stats
 */
async function enqueueRenderJobsAfterCrawl(
  projectId: string,
  crawlRunId: string,
): Promise<void> {
  logger.info('Enqueueing render jobs after crawl', {
    projectId,
    crawlRunId,
  });

  try {
    const result = await enqueueRenderJobs(crawlRunId, projectId);

    // Update totalsJson with render info
    const currentRun = await prisma.crawlRun.findUnique({
      where: { id: crawlRunId },
      select: { totalsJson: true },
    });

    const existingTotals = (currentRun?.totalsJson as Record<string, unknown>) ?? {};

    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        totalsJson: {
          ...existingTotals,
          renderMode: result.renderMode,
          renderQueuedCount: result.queuedCount,
        },
      },
    });

    logger.info('Render jobs enqueued', {
      projectId,
      crawlRunId,
      renderMode: result.renderMode,
      queuedCount: result.queuedCount,
    });
  } catch (error) {
    // Log error but don't fail the job - rendering is supplementary
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to enqueue render jobs', {
      projectId,
      crawlRunId,
      error: errorMessage,
    });
  }
}

/**
 * Compute diff between previous and current crawl runs
 * Updates the current run's totalsJson with diff summary
 */
async function computeDiffAfterCrawl(
  projectId: string,
  currentRunId: string
): Promise<void> {
  logger.info('Looking for previous completed run to compute diff', {
    projectId,
    currentRunId,
  });

  const previousRun = await findPreviousCompletedRun(projectId, currentRunId);

  if (!previousRun) {
    logger.info('No previous completed run found, skipping diff', {
      projectId,
      currentRunId,
    });
    return;
  }

  logger.info('Computing diff with previous run', {
    projectId,
    fromRunId: previousRun.id,
    toRunId: currentRunId,
  });

  try {
    const { diffId } = await computeCrawlDiff({
      projectId,
      fromRunId: previousRun.id,
      toRunId: currentRunId,
    });

    // Fetch the diff summary to update totalsJson
    const diff = await prisma.crawlDiff.findUnique({
      where: { id: diffId },
      select: { summaryJson: true },
    });

    const summaryJson = diff?.summaryJson as Record<string, unknown> | null;

    // Update current run's totalsJson with diff info
    const currentRun = await prisma.crawlRun.findUnique({
      where: { id: currentRunId },
      select: { totalsJson: true },
    });

    const existingTotals = (currentRun?.totalsJson as Record<string, unknown>) ?? {};

    await prisma.crawlRun.update({
      where: { id: currentRunId },
      data: {
        totalsJson: {
          ...existingTotals,
          diffId,
          diffSummary: {
            regressions: summaryJson?.regressions ?? 0,
            improvements: summaryJson?.improvements ?? 0,
            criticalRegressions: (summaryJson?.bySeverity as Record<string, number>)?.CRITICAL ?? 0,
          },
        },
      },
    });

    logger.info('Diff computed and saved', {
      projectId,
      diffId,
      regressions: summaryJson?.regressions,
      improvements: summaryJson?.improvements,
    });
  } catch (error) {
    // Log error but don't fail the job - diff is supplementary
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to compute diff', {
      projectId,
      currentRunId,
      error: errorMessage,
    });
  }
}

/**
 * Process a single crawl job
 */
async function processJob(job: Job<CrawlJobData>): Promise<void> {
  const { crawlRunId, projectId } = job.data;

  logger.info('Processing crawl job', {
    jobId: job.id,
    crawlRunId,
    projectId,
  });

  // Fetch the CrawlRun from DB
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
  });

  if (!crawlRun) {
    logger.error('CrawlRun not found', { crawlRunId });
    throw new Error(`CrawlRun ${crawlRunId} not found`);
  }

  // Check if already canceled
  if (crawlRun.status === 'CANCELED') {
    logger.info('CrawlRun already canceled, skipping', { crawlRunId });
    return;
  }

  // Update status to RUNNING
  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  logger.info('CrawlRun status updated to RUNNING', { crawlRunId });

  try {
    // Perform the BFS crawl
    await runCrawl({ projectId, crawlRunId });

    // Re-check if canceled during crawl
    const updatedCrawlRun = await prisma.crawlRun.findUnique({
      where: { id: crawlRunId },
    });

    if (updatedCrawlRun?.status === 'CANCELED') {
      logger.info('CrawlRun was canceled during execution', { crawlRunId });
      return;
    }

    // Update status to DONE
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
      },
    });

    logger.info('CrawlRun completed successfully', { crawlRunId });

    // Compute diff with previous run (non-blocking on errors)
    await computeDiffAfterCrawl(projectId, crawlRunId);

    // Enqueue render jobs based on project settings
    await enqueueRenderJobsAfterCrawl(projectId, crawlRunId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('CrawlRun failed', {
      crawlRunId,
      error: errorMessage,
    });

    // Update status to FAILED
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        totalsJson: {
          lastErrorMessage: errorMessage,
        },
      },
    });

    throw error;
  }
}

// Create the BullMQ worker
const worker = new Worker<CrawlJobData>(QUEUE_NAME, processJob, {
  connection: connectionOptions,
  concurrency,
});

// Worker event handlers
worker.on('ready', () => {
  logger.info('Crawler worker ready', {
    queue: QUEUE_NAME,
    concurrency,
    redisHost,
    redisPort,
  });
});

worker.on('completed', (job) => {
  logger.info('Job completed', {
    jobId: job.id,
    crawlRunId: job.data.crawlRunId,
  });
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', {
    jobId: job?.id,
    crawlRunId: job?.data.crawlRunId,
    error: error.message,
  });
});

worker.on('error', (error) => {
  logger.error('Worker error', { error: error.message });
});

// Health check server
let isWorkerReady = false;
const healthPort = parseInt(process.env.HEALTH_PORT || '8080', 10);
startHealthServer({
  port: healthPort,
  service: 'crawler',
  isReady: () => isWorkerReady,
});

worker.on('ready', () => {
  isWorkerReady = true;
});

// Graceful shutdown with job drain
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  isWorkerReady = false;
  logger.info('Received shutdown signal, draining active jobs...', { signal });

  // Pause the worker to stop accepting new jobs, then close
  await worker.pause();
  logger.info('Worker paused, waiting for active jobs to finish...');

  await worker.close();
  await closeRenderQueue();
  await disconnectPrisma();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('Starting crawler worker...', {
  queue: QUEUE_NAME,
  concurrency,
});
