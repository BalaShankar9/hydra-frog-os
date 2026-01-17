import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

/**
 * Status code distribution
 */
interface StatusCodeDistribution {
  [statusCode: string]: number;
}

/**
 * Error page info
 */
interface ErrorPage {
  url: string;
  statusCode: number;
  count: number; // Number of links pointing to this page
}

/**
 * Totals JSON structure for CrawlRun
 */
interface CrawlTotals {
  pagesCount: number;
  linksCount: number;
  internalLinksCount: number;
  externalLinksCount: number;
  brokenInternalLinksCount: number;
  statusCodeDistribution: StatusCodeDistribution;
  topErrorPages: ErrorPage[];
  lastErrorMessage?: string;
}

/**
 * Post-process the crawl to identify broken links and compute totals.
 */
export async function postProcessCrawl(crawlRunId: string): Promise<CrawlTotals> {
  logger.info('Starting post-processing', { crawlRunId });

  // Step 1: Get all pages with their normalized URLs and status codes
  const pages = await prisma.page.findMany({
    where: { crawlRunId },
    select: {
      normalizedUrl: true,
      statusCode: true,
    },
  });

  logger.info('Loaded pages for post-processing', {
    crawlRunId,
    pageCount: pages.length,
  });

  // Build map: normalizedUrl -> statusCode
  const pageStatusMap = new Map<string, number>();
  const statusCodeDistribution: StatusCodeDistribution = {};

  for (const page of pages) {
    if (page.statusCode !== null) {
      pageStatusMap.set(page.normalizedUrl, page.statusCode);

      // Count status codes
      const statusKey = String(page.statusCode);
      statusCodeDistribution[statusKey] = (statusCodeDistribution[statusKey] || 0) + 1;
    }
  }

  // Step 2: Find internal links pointing to error pages (4xx/5xx)
  const internalLinks = await prisma.link.findMany({
    where: {
      crawlRunId,
      linkType: 'INTERNAL',
    },
    select: {
      id: true,
      toNormalizedUrl: true,
    },
  });

  logger.info('Loaded internal links for broken link check', {
    crawlRunId,
    internalLinkCount: internalLinks.length,
  });

  // Collect broken links to update
  const brokenLinkUpdates: { id: string; statusCode: number }[] = [];
  const errorPageCounts = new Map<string, { statusCode: number; count: number }>();

  for (const link of internalLinks) {
    const targetStatus = pageStatusMap.get(link.toNormalizedUrl);

    if (targetStatus !== undefined && targetStatus >= 400) {
      brokenLinkUpdates.push({
        id: link.id,
        statusCode: targetStatus,
      });

      // Track error page counts for top errors
      const existing = errorPageCounts.get(link.toNormalizedUrl);
      if (existing) {
        existing.count++;
      } else {
        errorPageCounts.set(link.toNormalizedUrl, {
          statusCode: targetStatus,
          count: 1,
        });
      }
    }
  }

  logger.info('Found broken internal links', {
    crawlRunId,
    brokenCount: brokenLinkUpdates.length,
    errorPageCount: errorPageCounts.size,
  });

  // Step 3: Update broken links in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < brokenLinkUpdates.length; i += BATCH_SIZE) {
    const batch = brokenLinkUpdates.slice(i, i + BATCH_SIZE);

    // Update each link individually (Prisma doesn't support different values in updateMany)
    await Promise.all(
      batch.map((update) =>
        prisma.link.update({
          where: { id: update.id },
          data: {
            isBroken: true,
            statusCode: update.statusCode,
          },
        })
      )
    );

    logger.debug('Updated broken links batch', {
      crawlRunId,
      batchStart: i,
      batchSize: batch.length,
    });
  }

  // Step 4: Get link counts
  const [totalLinks, externalLinks] = await Promise.all([
    prisma.link.count({ where: { crawlRunId } }),
    prisma.link.count({ where: { crawlRunId, linkType: 'EXTERNAL' } }),
  ]);

  // Step 5: Build top error pages (top 10 by link count)
  const topErrorPages: ErrorPage[] = Array.from(errorPageCounts.entries())
    .map(([url, data]) => ({
      url,
      statusCode: data.statusCode,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Build totals
  const totals: CrawlTotals = {
    pagesCount: pages.length,
    linksCount: totalLinks,
    internalLinksCount: internalLinks.length,
    externalLinksCount: externalLinks,
    brokenInternalLinksCount: brokenLinkUpdates.length,
    statusCodeDistribution,
    topErrorPages,
  };

  logger.info('Post-processing complete', {
    crawlRunId,
    totals: {
      pagesCount: totals.pagesCount,
      linksCount: totals.linksCount,
      brokenInternalLinksCount: totals.brokenInternalLinksCount,
    },
  });

  return totals;
}

/**
 * Save totals to CrawlRun record.
 */
export async function saveCrawlTotals(
  crawlRunId: string,
  totals: CrawlTotals
): Promise<void> {
  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      totalsJson: JSON.parse(JSON.stringify(totals)),
    },
  });

  logger.info('Saved crawl totals', { crawlRunId });
}
