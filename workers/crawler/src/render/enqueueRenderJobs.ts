/**
 * Enqueue render jobs after crawl completes
 * Based on project's renderMode setting
 */

import { Queue } from 'bullmq';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { normalizeUrl } from '../url/normalize.js';
import type { RenderMode, ProjectSettings } from '@hydra-frog-os/shared';

// Redis connection options
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const connectionOptions = {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null as null,
};

// Queue name for render jobs
const RENDER_QUEUE_NAME = 'render-jobs';

// Lazy-initialized queue
let renderQueue: Queue | null = null;

function getRenderQueue(): Queue {
  if (!renderQueue) {
    renderQueue = new Queue(RENDER_QUEUE_NAME, {
      connection: connectionOptions,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }
  return renderQueue;
}

interface RenderJobData {
  crawlRunId: string;
  pageId: string;
  url: string;
}

interface EnqueueResult {
  renderMode: RenderMode;
  queuedCount: number;
  pageIds: string[];
}

/**
 * Get pages to render for KEY_PAGES mode
 * - Homepage (matching startUrl)
 * - One sample page per template
 */
async function getKeyPages(
  crawlRunId: string,
  startUrl: string,
): Promise<Array<{ id: string; url: string }>> {
  const pages: Array<{ id: string; url: string }> = [];
  const seenIds = new Set<string>();

  // Normalize the start URL with empty ignore params
  const normalizedStartUrl = normalizeUrl(startUrl, []);

  // Find homepage
  const homepage = await prisma.page.findFirst({
    where: {
      crawlRunId,
      normalizedUrl: normalizedStartUrl ?? undefined,
      statusCode: { gte: 200, lt: 300 },
    },
    select: { id: true, url: true },
  });

  if (homepage && !seenIds.has(homepage.id)) {
    pages.push({ id: homepage.id, url: homepage.url });
    seenIds.add(homepage.id);
    logger.info('Added homepage to render queue', { pageId: homepage.id, url: homepage.url });
  }

  // Find template sample pages
  const templates = await prisma.template.findMany({
    where: {
      crawlRunId,
      samplePageId: { not: null },
    },
    select: {
      id: true,
      name: true,
      samplePageId: true,
    },
  });

  if (templates.length > 0) {
    const samplePageIds = templates
      .map((t) => t.samplePageId)
      .filter((id): id is string => id !== null && !seenIds.has(id));

    if (samplePageIds.length > 0) {
      const samplePages = await prisma.page.findMany({
        where: {
          id: { in: samplePageIds },
          statusCode: { gte: 200, lt: 300 },
        },
        select: { id: true, url: true },
      });

      for (const page of samplePages) {
        if (!seenIds.has(page.id)) {
          pages.push({ id: page.id, url: page.url });
          seenIds.add(page.id);
        }
      }

      logger.info('Added template sample pages to render queue', {
        templateCount: templates.length,
        samplePagesAdded: samplePages.length,
      });
    }
  }

  return pages;
}

/**
 * Get all HTML pages with 2xx status for ALL_HTML mode
 */
async function getAllHtmlPages(
  crawlRunId: string,
): Promise<Array<{ id: string; url: string }>> {
  const pages = await prisma.page.findMany({
    where: {
      crawlRunId,
      statusCode: { gte: 200, lt: 300 },
      OR: [
        { contentType: { contains: 'text/html' } },
        { contentType: null }, // Include pages where contentType wasn't captured
      ],
    },
    select: { id: true, url: true },
    orderBy: { discoveredAt: 'asc' },
  });

  logger.info('Found HTML pages for ALL_HTML render', { count: pages.length });
  return pages;
}

/**
 * Enqueue render jobs based on project's renderMode setting
 */
export async function enqueueRenderJobs(
  crawlRunId: string,
  projectId: string,
): Promise<EnqueueResult> {
  logger.info('Checking render mode for project', { projectId, crawlRunId });

  // Fetch project settings
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      startUrl: true,
      settingsJson: true,
    },
  });

  if (!project) {
    logger.error('Project not found', { projectId });
    return { renderMode: 'OFF', queuedCount: 0, pageIds: [] };
  }

  const settings = (project.settingsJson as ProjectSettings) ?? {};
  const renderMode: RenderMode = settings.renderMode ?? 'KEY_PAGES';

  logger.info('Render mode', { projectId, renderMode });

  if (renderMode === 'OFF') {
    logger.info('Render mode is OFF, skipping render job enqueueing', { projectId });
    return { renderMode, queuedCount: 0, pageIds: [] };
  }

  // Get pages to render based on mode
  let pagesToRender: Array<{ id: string; url: string }>;

  if (renderMode === 'KEY_PAGES') {
    pagesToRender = await getKeyPages(crawlRunId, project.startUrl);
  } else {
    // ALL_HTML
    pagesToRender = await getAllHtmlPages(crawlRunId);
  }

  if (pagesToRender.length === 0) {
    logger.info('No pages to render', { projectId, renderMode });
    return { renderMode, queuedCount: 0, pageIds: [] };
  }

  // Update page statuses to QUEUED
  const pageIds = pagesToRender.map((p) => p.id);
  await prisma.page.updateMany({
    where: { id: { in: pageIds } },
    data: { renderStatus: 'QUEUED' },
  });

  // Enqueue render jobs
  const queue = getRenderQueue();
  const jobs: Array<{ name: string; data: RenderJobData; opts: { jobId: string } }> = [];

  for (const page of pagesToRender) {
    const jobId = `${crawlRunId}:${page.id}`;
    jobs.push({
      name: 'render-page',
      data: {
        crawlRunId,
        pageId: page.id,
        url: page.url,
      },
      opts: {
        jobId, // Idempotent - won't duplicate if same job exists
      },
    });
  }

  // Bulk add jobs
  await queue.addBulk(jobs);

  logger.info('Render jobs enqueued', {
    projectId,
    crawlRunId,
    renderMode,
    queuedCount: jobs.length,
  });

  return {
    renderMode,
    queuedCount: jobs.length,
    pageIds,
  };
}

/**
 * Close the render queue connection
 */
export async function closeRenderQueue(): Promise<void> {
  if (renderQueue) {
    await renderQueue.close();
    renderQueue = null;
  }
}
