/**
 * Renderer Worker
 * Consumes "render-jobs" queue and renders pages using Playwright
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  renderPage,
  closeBrowser,
  type RenderJobData,
  type RenderResult,
} from './render/index.js';

// Get directory name for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10),
    renderTimeout: parseInt(process.env.RENDER_TIMEOUT_MS || '20000', 10),
  },
  storage: {
    path: process.env.STORAGE_PATH || join(__dirname, '../../storage'),
  },
};

// Initialize Prisma with pg adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Queue name
const QUEUE_NAME = 'render-jobs';

/**
 * Save screenshot to disk
 */
async function saveScreenshot(
  crawlRunId: string,
  pageId: string,
  screenshot: Buffer,
): Promise<string> {
  const relativePath = `screenshots/${crawlRunId}/${pageId}.png`;
  const absolutePath = join(config.storage.path, relativePath);

  // Ensure directory exists
  await mkdir(dirname(absolutePath), { recursive: true });

  // Write screenshot
  await writeFile(absolutePath, screenshot);

  console.log(`[Renderer] Screenshot saved: ${relativePath}`);
  return relativePath;
}

/**
 * Process a render job
 */
async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { crawlRunId, pageId, url } = job.data;
  console.log(`[Renderer] Processing job ${job.id}: ${url}`);

  // Update status to RUNNING
  await prisma.page.update({
    where: { id: pageId },
    data: {
      renderStatus: 'RUNNING',
      renderStartedAt: new Date(),
    },
  });

  try {
    // Render the page
    const result: RenderResult = await renderPage(url, config.worker.renderTimeout);

    // Save screenshot
    const screenshotPath = await saveScreenshot(crawlRunId, pageId, result.screenshot);

    // Update page with rendered data
    await prisma.page.update({
      where: { id: pageId },
      data: {
        renderStatus: 'DONE',
        renderFinishedAt: new Date(),
        renderedFinalUrl: result.finalUrl,
        renderedTitle: result.title,
        renderedMetaDescription: result.metaDescription,
        renderedCanonical: result.canonical,
        renderedRobotsMeta: result.robotsMeta,
        renderedH1Count: result.h1Count,
        renderedWordCount: result.wordCount,
        renderedHtmlHash: result.htmlHash,
        renderedLinksCount: result.linksCount,
        renderConsoleErrorsJson: result.consoleErrors.length > 0 
          ? result.consoleErrors as unknown as Prisma.InputJsonValue 
          : Prisma.JsonNull,
        renderNetworkErrorsJson: result.networkErrors.length > 0 
          ? result.networkErrors as unknown as Prisma.InputJsonValue 
          : Prisma.JsonNull,
        renderScreenshotPath: screenshotPath,
      },
    });

    console.log(`[Renderer] Job ${job.id} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Renderer] Job ${job.id} failed:`, errorMessage);

    // Update status to FAILED
    await prisma.page.update({
      where: { id: pageId },
      data: {
        renderStatus: 'FAILED',
        renderFinishedAt: new Date(),
        renderConsoleErrorsJson: [{ type: 'error', text: errorMessage }],
      },
    });

    throw error; // Re-throw to let BullMQ handle retry logic
  }
}

/**
 * Start the worker
 */
async function startWorker(): Promise<void> {
  console.log('[Renderer] Starting renderer worker...');
  console.log(`[Renderer] Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`[Renderer] Concurrency: ${config.worker.concurrency}`);
  console.log(`[Renderer] Render timeout: ${config.worker.renderTimeout}ms`);
  console.log(`[Renderer] Storage path: ${config.storage.path}`);

  // Ensure storage directory exists
  await mkdir(join(config.storage.path, 'screenshots'), { recursive: true });

  // Create Redis connection config for worker
  const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null as null, // Required for BullMQ
  };

  // Create worker
  const worker = new Worker<RenderJobData>(QUEUE_NAME, processRenderJob, {
    connection,
    concurrency: config.worker.concurrency,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  });

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Renderer] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Renderer] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Renderer] Worker error:', err.message);
  });

  worker.on('ready', () => {
    console.log(`[Renderer] Worker ready, listening on queue: ${QUEUE_NAME}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Renderer] Received ${signal}, shutting down...`);

    await worker.close();
    console.log('[Renderer] Worker closed');

    await closeBrowser();

    await prisma.$disconnect();
    console.log('[Renderer] Prisma disconnected');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('[Renderer] Worker started successfully');
}

// Start the worker
startWorker().catch((error) => {
  console.error('[Renderer] Failed to start worker:', error);
  process.exit(1);
});
