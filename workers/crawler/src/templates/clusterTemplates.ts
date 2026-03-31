/**
 * Template Clustering Service
 * 
 * Groups pages by their structural template signature and creates
 * Template records for efficient page categorization.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

/**
 * Maximum number of pages to cluster in a single run
 * This prevents memory issues on very large crawls
 */
const MAX_PAGES_FOR_CLUSTERING = 50000;

/**
 * Page data needed for clustering
 */
interface PageForClustering {
  id: string;
  url: string;
  templateSignatureHash: string;
  templateSignatureJson: Prisma.JsonValue;
}

/**
 * Template cluster info
 */
interface TemplateCluster {
  signatureHash: string;
  signatureJson: Prisma.JsonValue;
  pages: PageForClustering[];
}

/**
 * URL pattern matchers for template naming
 */
const URL_PATTERN_NAMES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\/blog\//i, name: 'Blog Template' },
  { pattern: /\/posts?\//i, name: 'Post Template' },
  { pattern: /\/products?\//i, name: 'Product Template' },
  { pattern: /\/shop\//i, name: 'Shop Template' },
  { pattern: /\/categor(y|ies)\//i, name: 'Category Template' },
  { pattern: /\/tag\//i, name: 'Tag Template' },
  { pattern: /\/author\//i, name: 'Author Template' },
  { pattern: /\/news\//i, name: 'News Template' },
  { pattern: /\/article\//i, name: 'Article Template' },
  { pattern: /\/page\//i, name: 'Page Template' },
  { pattern: /\/services?\//i, name: 'Service Template' },
  { pattern: /\/about/i, name: 'About Template' },
  { pattern: /\/contact/i, name: 'Contact Template' },
  { pattern: /\/faq/i, name: 'FAQ Template' },
  { pattern: /\/search/i, name: 'Search Template' },
  { pattern: /\/login|\/signin/i, name: 'Login Template' },
  { pattern: /\/register|\/signup/i, name: 'Registration Template' },
  { pattern: /\/cart/i, name: 'Cart Template' },
  { pattern: /\/checkout/i, name: 'Checkout Template' },
  { pattern: /\/account|\/profile/i, name: 'Account Template' },
];

/**
 * Derive a template name from the URLs in a cluster
 */
function deriveTemplateName(pages: PageForClustering[], index: number): string {
  // Check URL patterns - find the most common pattern match
  const patternCounts = new Map<string, number>();
  
  for (const page of pages) {
    for (const { pattern, name } of URL_PATTERN_NAMES) {
      if (pattern.test(page.url)) {
        patternCounts.set(name, (patternCounts.get(name) || 0) + 1);
        break; // Only count first match per URL
      }
    }
  }
  
  // If any pattern matches majority of pages, use it
  if (patternCounts.size > 0) {
    let bestPattern = '';
    let bestCount = 0;
    
    for (const [name, count] of patternCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestPattern = name;
      }
    }
    
    // Use pattern if it matches at least 30% of pages
    if (bestCount >= pages.length * 0.3) {
      return bestPattern;
    }
  }
  
  // Try to derive from common path prefix
  const pathSegments = pages.map(p => {
    try {
      const url = new URL(p.url);
      return url.pathname.split('/').filter(Boolean).slice(0, 2);
    } catch {
      return [];
    }
  });
  
  // Find common first segment
  if (pathSegments.length > 0 && pathSegments[0].length > 0) {
    const firstSegment = pathSegments[0][0];
    const matchCount = pathSegments.filter(s => s[0] === firstSegment).length;
    
    // If 50%+ share the same first segment, use it
    if (matchCount >= pages.length * 0.5 && firstSegment) {
      // Capitalize first letter
      const capitalizedName = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
      return `${capitalizedName} Template`;
    }
  }
  
  // Fallback to generic name with index
  return `Template ${index + 1}`;
}

/**
 * Cluster pages by template signature and create Template records
 * 
 * @param crawlRunId - The crawl run to cluster templates for
 */
export async function clusterTemplates(crawlRunId: string): Promise<void> {
  logger.info('Starting template clustering', { crawlRunId });

  // Fetch pages with template signatures
  const pages = await prisma.page.findMany({
    where: {
      crawlRunId,
      templateSignatureHash: { not: null },
    },
    select: {
      id: true,
      url: true,
      templateSignatureHash: true,
      templateSignatureJson: true,
    },
    take: MAX_PAGES_FOR_CLUSTERING,
    orderBy: { discoveredAt: 'asc' },
  });

  logger.info('Fetched pages for clustering', { 
    crawlRunId, 
    pageCount: pages.length,
    maxPages: MAX_PAGES_FOR_CLUSTERING 
  });

  if (pages.length === 0) {
    logger.info('No pages with template signatures to cluster', { crawlRunId });
    return;
  }

  // Group pages by signature hash
  const clusters = new Map<string, TemplateCluster>();

  for (const page of pages) {
    if (!page.templateSignatureHash) continue;

    const existing = clusters.get(page.templateSignatureHash);
    if (existing) {
      existing.pages.push(page as PageForClustering);
    } else {
      clusters.set(page.templateSignatureHash, {
        signatureHash: page.templateSignatureHash,
        signatureJson: page.templateSignatureJson,
        pages: [page as PageForClustering],
      });
    }
  }

  logger.info('Grouped pages into clusters', { 
    crawlRunId, 
    clusterCount: clusters.size 
  });

  // Sort clusters by page count descending
  const sortedClusters = Array.from(clusters.values()).sort(
    (a, b) => b.pages.length - a.pages.length
  );

  // Create Template records and update pages
  let templateIndex = 0;
  for (const cluster of sortedClusters) {
    const templateName = deriveTemplateName(cluster.pages, templateIndex);
    
    // Use sample page - prefer first discovered page with 200 status
    const samplePage = cluster.pages[0];

    // Upsert template - use signatureHash as unique identifier within crawl run
    const template = await prisma.template.upsert({
      where: {
        crawlRunId_signatureHash: {
          crawlRunId,
          signatureHash: cluster.signatureHash,
        },
      },
      create: {
        crawlRunId,
        name: templateName,
        signatureHash: cluster.signatureHash,
        signatureJson: cluster.signatureJson as Prisma.InputJsonValue,
        pageCount: cluster.pages.length,
        samplePageId: samplePage.id,
      },
      update: {
        name: templateName,
        pageCount: cluster.pages.length,
        samplePageId: samplePage.id,
      },
    });

    // Update all pages in this cluster with templateId
    const pageIds = cluster.pages.map(p => p.id);
    await prisma.page.updateMany({
      where: { id: { in: pageIds } },
      data: { templateId: template.id },
    });

    logger.debug('Created/updated template', {
      templateId: template.id,
      name: templateName,
      pageCount: cluster.pages.length,
      signatureHash: cluster.signatureHash.substring(0, 12),
    });

    templateIndex++;
  }

  logger.info('Template clustering complete', {
    crawlRunId,
    templatesCreated: sortedClusters.length,
    pagesProcessed: pages.length,
  });
}

/**
 * Compute template statistics for totalsJson
 */
export interface TemplateStats {
  templateCount: number;
  largestTemplatePageCount: number;
  topTemplates: Array<{ name: string; pageCount: number }>;
}

/**
 * Get template statistics for a crawl run
 */
export async function getTemplateStats(crawlRunId: string): Promise<TemplateStats> {
  const templates = await prisma.template.findMany({
    where: { crawlRunId },
    select: {
      id: true,
      name: true,
      pageCount: true,
    },
    orderBy: { pageCount: 'desc' },
    take: 10,
  });

  const totalCount = await prisma.template.count({
    where: { crawlRunId },
  });

  return {
    templateCount: totalCount,
    largestTemplatePageCount: templates[0]?.pageCount ?? 0,
    topTemplates: templates.map(t => ({
      name: t.name,
      pageCount: t.pageCount,
    })),
  };
}

/**
 * Save template stats to crawl run totalsJson
 */
export async function saveTemplateStats(
  crawlRunId: string,
  stats: TemplateStats
): Promise<void> {
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: { totalsJson: true },
  });

  const existingTotals = (crawlRun?.totalsJson as Record<string, unknown>) ?? {};
  
  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      totalsJson: {
        ...existingTotals,
        templates: stats as unknown as Prisma.JsonValue,
      },
    },
  });

  logger.info('Saved template stats to totalsJson', {
    crawlRunId,
    templateCount: stats.templateCount,
  });
}
