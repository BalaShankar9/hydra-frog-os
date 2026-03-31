/**
 * Enqueue performance audit jobs after crawl completion
 */

import { Queue, JobsOptions } from 'bullmq';
import { PrismaClient, PerfDevice, PerfAuditStatus } from '@prisma/client';
import { logger } from '../logger.js';

const PERF_JOBS_QUEUE = 'perf-jobs';

export interface PerfJobData {
  crawlRunId: string;
  projectId: string;
  pageId?: string;
  url: string;
  templateId?: string;
  device: 'MOBILE' | 'DESKTOP';
}

export interface ProjectPerfSettings {
  performanceEnabled: boolean;
  performanceMode: 'OFF' | 'KEY_PAGES' | 'ALL_HTML';
  perfDevice: 'MOBILE' | 'DESKTOP';
  perfBudgets?: {
    maxLcpMs?: number;
    maxCls?: number;
    maxInpMs?: number;
    minScore?: number;
  };
}

/**
 * Extract performance settings from project settingsJson with defaults
 */
export function getPerfSettings(settingsJson: unknown): ProjectPerfSettings {
  const settings = (settingsJson ?? {}) as Record<string, unknown>;

  return {
    performanceEnabled: settings.performanceEnabled === true,
    performanceMode: 
      (settings.performanceMode as 'OFF' | 'KEY_PAGES' | 'ALL_HTML') || 'KEY_PAGES',
    perfDevice: 
      (settings.perfDevice as 'MOBILE' | 'DESKTOP') || 'MOBILE',
    perfBudgets: settings.perfBudgets as ProjectPerfSettings['perfBudgets'] | undefined,
  };
}

/**
 * Normalize a URL for deduplication (same as in perf-auditor)
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let normalized = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    if (u.search) {
      normalized += u.search;
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Get pages to audit based on performance mode
 */
async function getTargetPages(
  prisma: PrismaClient,
  crawlRunId: string,
  mode: ProjectPerfSettings['performanceMode'],
): Promise<Array<{ id: string; url: string; templateId: string | null }>> {
  if (mode === 'OFF') {
    return [];
  }

  if (mode === 'ALL_HTML') {
    // Get all 200 HTML pages
    const pages = await prisma.page.findMany({
      where: {
        crawlRunId,
        statusCode: 200,
        contentType: { contains: 'text/html' },
      },
      select: {
        id: true,
        url: true,
        templateId: true,
      },
    });
    return pages;
  }

  // KEY_PAGES mode: homepage + 1 sample per template
  const keyPages: Array<{ id: string; url: string; templateId: string | null }> = [];

  // Get homepage (depth 0 or startUrl)
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    include: {
      project: { select: { startUrl: true } },
    },
  });

  if (crawlRun) {
    const homepage = await prisma.page.findFirst({
      where: {
        crawlRunId,
        statusCode: 200,
        contentType: { contains: 'text/html' },
        depth: 0,
      },
      select: { id: true, url: true, templateId: true },
    });

    if (homepage) {
      keyPages.push(homepage);
    }
  }

  // Get 1 sample page per template
  const templates = await prisma.template.findMany({
    where: { crawlRunId },
    select: { id: true },
  });

  for (const template of templates) {
    // Skip if we already have this template via homepage
    if (keyPages.some(p => p.templateId === template.id)) {
      continue;
    }

    const samplePage = await prisma.page.findFirst({
      where: {
        crawlRunId,
        templateId: template.id,
        statusCode: 200,
        contentType: { contains: 'text/html' },
      },
      select: { id: true, url: true, templateId: true },
      orderBy: { depth: 'asc' }, // Prefer shallower pages
    });

    if (samplePage) {
      keyPages.push(samplePage);
    }
  }

  return keyPages;
}

/**
 * Enqueue performance audit jobs for a completed crawl
 */
export async function enqueuePerfJobs({
  prisma,
  perfQueue,
  crawlRunId,
  projectId,
}: {
  prisma: PrismaClient;
  perfQueue: Queue;
  crawlRunId: string;
  projectId: string;
}): Promise<{ enqueuedCount: number; skipped: boolean; reason?: string }> {
  logger.info('Checking perf audit eligibility', { crawlRunId, projectId });

  // Load project settings
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { settingsJson: true },
  });

  if (!project) {
    return { enqueuedCount: 0, skipped: true, reason: 'Project not found' };
  }

  const perfSettings = getPerfSettings(project.settingsJson);

  // Check if performance audits are enabled
  if (!perfSettings.performanceEnabled || perfSettings.performanceMode === 'OFF') {
    logger.info('Performance audits disabled', { 
      crawlRunId, 
      performanceEnabled: perfSettings.performanceEnabled,
      performanceMode: perfSettings.performanceMode,
    });
    return { enqueuedCount: 0, skipped: true, reason: 'Performance audits disabled' };
  }

  // Get target pages based on mode
  const targetPages = await getTargetPages(prisma, crawlRunId, perfSettings.performanceMode);

  if (targetPages.length === 0) {
    logger.info('No pages to audit', { crawlRunId, mode: perfSettings.performanceMode });
    return { enqueuedCount: 0, skipped: true, reason: 'No qualifying pages found' };
  }

  logger.info('Enqueueing perf jobs', { 
    crawlRunId, 
    pageCount: targetPages.length,
    device: perfSettings.perfDevice,
    mode: perfSettings.performanceMode,
  });

  let enqueuedCount = 0;

  // Enqueue jobs for each page
  for (const page of targetPages) {
    const normalizedUrl = normalizeUrl(page.url);

    // Check if audit already exists
    const existingAudit = await prisma.perfAudit.findFirst({
      where: {
        crawlRunId,
        normalizedUrl,
        device: perfSettings.perfDevice as PerfDevice,
      },
    });

    if (existingAudit && existingAudit.status !== 'SKIPPED') {
      // Already queued or processed
      logger.debug('Perf audit already exists', { 
        pageId: page.id, 
        url: page.url,
        status: existingAudit.status,
      });
      continue;
    }

    // Create or update PerfAudit record with QUEUED status
    if (existingAudit) {
      await prisma.perfAudit.update({
        where: { id: existingAudit.id },
        data: { status: 'QUEUED' as PerfAuditStatus },
      });
    } else {
      await prisma.perfAudit.create({
        data: {
          crawlRunId,
          projectId,
          pageId: page.id,
          templateId: page.templateId,
          url: page.url,
          normalizedUrl,
          device: perfSettings.perfDevice as PerfDevice,
          status: 'QUEUED' as PerfAuditStatus,
        },
      });
    }

    // Prepare job data
    const jobData: PerfJobData = {
      crawlRunId,
      projectId,
      pageId: page.id,
      url: page.url,
      templateId: page.templateId ?? undefined,
      device: perfSettings.perfDevice,
    };

    // Stable job ID for idempotency
    const jobId = `perf-${crawlRunId}-${normalizedUrl}-${perfSettings.perfDevice}`;

    const jobOpts: JobsOptions = {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 1000,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    };

    await perfQueue.add('perf-audit', jobData, jobOpts);
    enqueuedCount++;

    logger.debug('Perf job enqueued', { 
      jobId, 
      url: page.url,
      device: perfSettings.perfDevice,
    });
  }

  // Update crawl run totals with perf queue info
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: { totalsJson: true },
  });

  const currentTotals = (crawlRun?.totalsJson ?? {}) as Record<string, unknown>;
  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      totalsJson: {
        ...currentTotals,
        perfQueuedCount: enqueuedCount,
        perfDevice: perfSettings.perfDevice,
        perfMode: perfSettings.performanceMode,
      },
    },
  });

  logger.info('Perf jobs enqueued', { 
    crawlRunId, 
    enqueuedCount,
    device: perfSettings.perfDevice,
    mode: perfSettings.performanceMode,
  });

  return { enqueuedCount, skipped: false };
}
