import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { buildCrawlSettings, type CrawlSettings, type QueueItem, type PageResult } from '../types.js';
import { normalizeUrl, resolveAndNormalize } from '../url/normalize.js';
import { isInternalUrl } from '../url/isInternal.js';
import { postProcessCrawl, saveCrawlTotals } from './post-processor.js';
import { generateGlobalIssues } from './global-issues.js';
import { computeIssueSummary, saveIssueSummary } from './issue-summary.js';
import { evaluatePageIssues, type IssueDraft } from '@hydra-frog-os/shared/issues';
import { computeTemplateSignature } from '../templates/computeTemplateSignature.js';

/**
 * Placeholder for fetching and parsing a page.
 * Will be implemented in the next prompt.
 */
async function fetchAndParsePage(url: string): Promise<PageResult> {
  logger.debug('Fetching page (placeholder)', { url });

  // Placeholder - return empty links for now
  return {
    url,
    statusCode: 200,
    contentType: 'text/html',
    title: null,
    metaDescription: null,
    h1Count: null,
    canonical: null,
    robotsMeta: null,
    wordCount: null,
    links: [],
    imagesMissingAlt: 0,
    error: null,
    html: null,
  };
}

/**
 * Sleep for the specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if the crawl has been canceled.
 */
async function isCrawlCanceled(crawlRunId: string): Promise<boolean> {
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: { status: true },
  });

  return crawlRun?.status === 'CANCELED';
}

/**
 * Compute template signature for HTML pages
 * Returns null/DbNull fields if not applicable or on error
 */
function computePageTemplateSignature(result: PageResult): {
  templateSignatureHash: string | null;
  templateSignatureJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
} {
  // Only compute for HTML pages with content
  if (!result.html || !result.contentType?.includes('text/html')) {
    return { templateSignatureHash: null, templateSignatureJson: Prisma.DbNull };
  }

  try {
    const signature = computeTemplateSignature(result.html);
    if (signature) {
      // Convert to plain JSON for Prisma compatibility
      const jsonValue = JSON.parse(JSON.stringify(signature.signatureJson));
      return {
        templateSignatureHash: signature.signatureHash,
        templateSignatureJson: jsonValue as Prisma.InputJsonValue,
      };
    }
  } catch (error) {
    logger.warn('Failed to compute template signature', {
      url: result.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { templateSignatureHash: null, templateSignatureJson: Prisma.DbNull };
}

/**
 * Run the BFS crawl for a project.
 */
export async function runCrawl({
  projectId,
  crawlRunId,
}: {
  projectId: string;
  crawlRunId: string;
}): Promise<void> {
  logger.info('Starting BFS crawl', { projectId, crawlRunId });

  // Load project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Load crawl run
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
  });

  if (!crawlRun) {
    throw new Error(`CrawlRun ${crawlRunId} not found`);
  }

  // Build settings from project settingsJson
  const settings: CrawlSettings = buildCrawlSettings(
    project.settingsJson as Record<string, unknown> | null
  );

  logger.info('Crawl settings', {
    crawlRunId,
    maxPages: settings.maxPages,
    maxDepth: settings.maxDepth,
    ignoreParams: settings.ignoreParams,
    throttleMs: settings.throttleMs,
    includeSubdomains: settings.includeSubdomains,
  });

  // Idempotency: Delete existing pages, links, and issues for this crawl run
  // This ensures retries don't create duplicates
  logger.info('Cleaning up existing data for crawl run', { crawlRunId });
  await prisma.issue.deleteMany({ where: { crawlRunId } });
  await prisma.link.deleteMany({ where: { crawlRunId } });
  await prisma.page.deleteMany({ where: { crawlRunId } });

  // Initialize BFS
  const startUrl = project.startUrl;
  const baseDomain = project.domain;

  const normalizedStart = normalizeUrl(startUrl, settings.ignoreParams);
  if (!normalizedStart) {
    throw new Error(`Invalid start URL: ${startUrl}`);
  }

  const queue: QueueItem[] = [{ url: normalizedStart, depth: 0 }];
  const visited = new Set<string>();
  let pagesProcessed = 0;
  let cancelCheckCounter = 0;
  const CANCEL_CHECK_INTERVAL = 20;

  logger.info('BFS crawl initialized', {
    crawlRunId,
    startUrl: normalizedStart,
    baseDomain,
  });

  // BFS loop
  while (queue.length > 0) {
    // Check for cancellation periodically
    cancelCheckCounter++;
    if (cancelCheckCounter >= CANCEL_CHECK_INTERVAL) {
      cancelCheckCounter = 0;
      if (await isCrawlCanceled(crawlRunId)) {
        logger.info('Crawl canceled, stopping', { crawlRunId, pagesProcessed });
        return;
      }
    }

    // Check max pages limit
    if (visited.size >= settings.maxPages) {
      logger.info('Max pages limit reached', {
        crawlRunId,
        maxPages: settings.maxPages,
        pagesProcessed,
      });
      break;
    }

    // Dequeue next item
    const item = queue.shift()!;
    const { url, depth } = item;

    // Skip if depth exceeds maxDepth
    if (depth > settings.maxDepth) {
      logger.debug('Skipping URL (max depth exceeded)', { url, depth, maxDepth: settings.maxDepth });
      continue;
    }

    // Normalize URL
    const normalizedUrl = normalizeUrl(url, settings.ignoreParams);
    if (!normalizedUrl) {
      logger.debug('Skipping URL (normalization failed)', { url });
      continue;
    }

    // Skip if already visited
    if (visited.has(normalizedUrl)) {
      continue;
    }

    // Mark as visited
    visited.add(normalizedUrl);
    pagesProcessed++;

    logger.debug('Processing URL', {
      url: normalizedUrl,
      depth,
      pagesProcessed,
      queueSize: queue.length,
    });

    try {
      // Fetch and parse the page
      const result = await fetchAndParsePage(normalizedUrl);

      if (result.error) {
        logger.warn('Page fetch error', { url: normalizedUrl, error: result.error });
        continue;
      }

      // Compute template signature for HTML pages
      const { templateSignatureHash, templateSignatureJson } = computePageTemplateSignature(result);

      // Create Page record in database with template signature
      const page = await prisma.page.create({
        data: {
          crawlRunId,
          url: normalizedUrl,
          normalizedUrl,
          statusCode: result.statusCode,
          contentType: result.contentType,
          title: result.title,
          metaDescription: result.metaDescription,
          h1Count: result.h1Count,
          canonical: result.canonical,
          robotsMeta: result.robotsMeta,
          wordCount: result.wordCount,
          templateSignatureHash,
          templateSignatureJson,
        },
      });

      logger.debug('Page created', { 
        pageId: page.id, 
        url: normalizedUrl,
        hasTemplateSignature: !!templateSignatureHash,
      });

      // Evaluate page-level issues (only if we have a valid status code)
      if (result.statusCode !== null) {
        const issueDrafts: IssueDraft[] = evaluatePageIssues(
          {
            statusCode: result.statusCode,
            title: result.title,
            metaDescription: result.metaDescription,
            h1Count: result.h1Count,
            canonical: result.canonical,
            robotsMeta: result.robotsMeta,
            wordCount: result.wordCount,
          },
          { imagesMissingAlt: result.imagesMissingAlt }
        );

        if (issueDrafts.length > 0) {
          await prisma.issue.createMany({
            data: issueDrafts.map((draft) => ({
              crawlRunId,
              pageId: page.id,
              type: draft.type,
              severity: draft.severity,
              title: draft.title,
              description: draft.description,
              recommendation: draft.recommendation,
              evidenceJson: JSON.parse(JSON.stringify(draft.evidenceJson ?? {})),
            })),
          });

          logger.debug('Issues created for page', {
            pageId: page.id,
            issueCount: issueDrafts.length,
          });
        }
      }

      // Process discovered links
      for (const link of result.links) {
        // Resolve and normalize the link
        const normalizedLink = resolveAndNormalize(link, normalizedUrl, settings.ignoreParams);
        if (!normalizedLink) {
          continue;
        }

        // Check if internal
        if (!isInternalUrl(normalizedLink, baseDomain, settings.includeSubdomains)) {
          continue;
        }

        // Skip if already visited or in queue
        if (visited.has(normalizedLink)) {
          continue;
        }

        // Add to queue with incremented depth
        queue.push({ url: normalizedLink, depth: depth + 1 });
      }

      // Throttle between requests
      if (settings.throttleMs > 0) {
        await sleep(settings.throttleMs);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error processing URL', { url: normalizedUrl, error: errorMessage });
    }
  }

  logger.info('BFS crawl completed', {
    crawlRunId,
    pagesProcessed,
    totalVisited: visited.size,
  });

  // Post-processing: identify broken links and compute totals
  const totals = await postProcessCrawl(crawlRunId);
  await saveCrawlTotals(crawlRunId, totals);

  // Generate global issues (duplicate titles, etc.)
  await generateGlobalIssues(crawlRunId);

  // Compute and save issue summary to totalsJson
  const issueSummary = await computeIssueSummary(crawlRunId);
  await saveIssueSummary(crawlRunId, issueSummary);

  logger.info('Crawl post-processing complete', { crawlRunId });
}
