/**
 * Perf Auditor Worker
 * Consumes perf-jobs queue and runs Lighthouse audits
 */

import { Worker, Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { config } from './config.js';
import type { PerfJobData } from './types.js';
import { runLighthouse, closeChrome } from './lighthouse/index.js';
import { storeReports } from './storage.js';

const QUEUE_NAME = 'perf-jobs';

/**
 * Normalize a URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash, lowercase host
    let normalized = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    // Keep query string if present
    if (u.search) {
      normalized += u.search;
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Process a single perf job
 */
async function processJob(job: Job<PerfJobData>): Promise<void> {
  const { crawlRunId, projectId, pageId, url, templateId, device } = job.data;
  const jobId = job.id ?? 'unknown';

  console.log(`[PerfAuditor] Processing job ${jobId}: ${url} (${device})`);

  const normalizedUrl = normalizeUrl(url);

  // Find or create the PerfAudit record
  let audit = await prisma.perfAudit.findFirst({
    where: {
      crawlRunId,
      normalizedUrl,
      device,
    },
  });

  if (!audit) {
    // Create new audit record
    audit = await prisma.perfAudit.create({
      data: {
        crawlRunId,
        projectId,
        url,
        normalizedUrl,
        device,
        status: 'RUNNING',
        startedAt: new Date(),
        pageId: pageId ?? null,
        templateId: templateId ?? null,
      },
    });
  } else {
    // Update status to running
    audit = await prisma.perfAudit.update({
      where: { id: audit.id },
      data: { 
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  try {
    // Run Lighthouse audit
    const result = await runLighthouse(url, device, config.worker.lighthouseTimeoutMs);

    // Store reports to filesystem
    const { jsonPath, htmlPath } = await storeReports(
      crawlRunId,
      url,
      device,
      result.jsonReport,
      result.htmlReport,
    );

    // Update audit record with results
    await prisma.perfAudit.update({
      where: { id: audit.id },
      data: {
        status: 'DONE',
        score: result.score,
        metricsJson: result.metrics as unknown as Prisma.InputJsonObject,
        opportunitiesJson: result.opportunities as unknown as Prisma.InputJsonArray,
        reportJsonPath: jsonPath,
        reportHtmlPath: htmlPath,
        finishedAt: new Date(),
      },
    });

    console.log(`[PerfAuditor] Job ${jobId} completed: score=${result.score}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[PerfAuditor] Job ${jobId} failed:`, errorMessage);

    // Update audit record with error
    await prisma.perfAudit.update({
      where: { id: audit.id },
      data: {
        status: 'FAILED',
        errorJson: { message: errorMessage, stack: errorStack },
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Start the worker
 */
async function main(): Promise<void> {
  console.log('[PerfAuditor] Starting worker...');
  console.log(`[PerfAuditor] Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`[PerfAuditor] Concurrency: ${config.worker.concurrency}`);

  const worker = new Worker<PerfJobData>(
    QUEUE_NAME,
    async (job) => {
      await processJob(job);
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
      },
      concurrency: config.worker.concurrency,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[PerfAuditor] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[PerfAuditor] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[PerfAuditor] Worker error:', error);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[PerfAuditor] Received ${signal}, shutting down...`);
    await worker.close();
    await closeChrome();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('[PerfAuditor] Worker started, waiting for jobs...');
}

main().catch((error) => {
  console.error('[PerfAuditor] Fatal error:', error);
  process.exit(1);
});
