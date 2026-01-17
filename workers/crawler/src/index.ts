import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma, disconnectPrisma } from './prisma.js';
import { logger } from './logger.js';
import { runCrawl } from './crawl/crawl-runner.js';

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

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info('Received shutdown signal', { signal });

  await worker.close();
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

