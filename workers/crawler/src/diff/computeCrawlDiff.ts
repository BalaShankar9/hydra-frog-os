import { prisma } from '../prisma.js';
import { DiffType, DiffSeverity, Prisma } from '@prisma/client';
import { logger } from '../logger.js';
import { stableStringify, pickRelevantFields } from './diffUtils.js';

// ============================================
// Types
// ============================================

export interface ComputeCrawlDiffInput {
  projectId: string;
  fromRunId: string;
  toRunId: string;
}

export interface ComputeCrawlDiffResult {
  diffId: string;
}

export type Direction = 'REGRESSION' | 'IMPROVEMENT' | 'NEUTRAL';

interface PageSnapshot {
  normalizedUrl: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1Count: number | null;
  wordCount: number | null;
  htmlHash: string | null;
  redirectChainJson: unknown;
  templateId: string | null;
}

interface DiffItemInput {
  normalizedUrl: string;
  url: string;
  type: DiffType;
  severity: DiffSeverity;
  direction: Direction;
  beforeJson: Partial<PageSnapshot> | null;
  afterJson: Partial<PageSnapshot> | null;
}

interface DiffSummary {
  totalItems: number;
  regressions: number;
  improvements: number;
  neutral: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topRegressions: Array<{
    normalizedUrl: string;
    type: DiffType;
    severity: DiffSeverity;
  }>;
}

// ============================================
// Constants
// ============================================

const BATCH_SIZE = 1000;
const PAGE_FETCH_BATCH = 10000;

// Wordcount threshold: change >= 20% OR abs diff >= 200 words
const WORDCOUNT_PERCENT_THRESHOLD = 0.2;
const WORDCOUNT_ABS_THRESHOLD = 200;

// ============================================
// Main Function
// ============================================

export async function computeCrawlDiff(
  input: ComputeCrawlDiffInput
): Promise<ComputeCrawlDiffResult> {
  const { projectId, fromRunId, toRunId } = input;
  const startTime = Date.now();

  logger.info(`Computing diff for project=${projectId} from=${fromRunId} to=${toRunId}`);

  // Fetch pages for both runs
  const fromPages = await fetchPagesForRun(fromRunId);
  const toPages = await fetchPagesForRun(toRunId);

  const fetchTime = Date.now() - startTime;
  logger.info(`Fetched ${fromPages.size} pages from fromRun, ${toPages.size} pages from toRun in ${fetchTime}ms`);

  // Compute diff items
  const computeStart = Date.now();
  const diffItems = computeDiffItems(fromPages, toPages);
  const computeTime = Date.now() - computeStart;

  logger.info(`Generated ${diffItems.length} diff items in ${computeTime}ms`);

  // Compute summary
  const summary = computeSummary(diffItems);

  // Upsert CrawlDiff
  const diff = await prisma.crawlDiff.upsert({
    where: {
      fromRunId_toRunId: { fromRunId, toRunId },
    },
    create: {
      projectId,
      fromRunId,
      toRunId,
      summaryJson: summary as unknown as Prisma.InputJsonValue,
    },
    update: {
      summaryJson: summary as unknown as Prisma.InputJsonValue,
    },
  });

  // Delete existing items (idempotent)
  await prisma.crawlDiffItem.deleteMany({
    where: { diffId: diff.id },
  });

  // Insert items in batches
  const insertStart = Date.now();
  await insertItemsInBatches(diff.id, diffItems);
  const insertTime = Date.now() - insertStart;

  const totalTime = Date.now() - startTime;
  logger.info(`Saved diff id=${diff.id} with ${diffItems.length} items in ${insertTime}ms (total: ${totalTime}ms)`);

  return { diffId: diff.id };
}

// ============================================
// Page Fetching
// ============================================

async function fetchPagesForRun(runId: string): Promise<Map<string, PageSnapshot>> {
  const pageMap = new Map<string, PageSnapshot>();
  let cursor: string | undefined;

  while (true) {
    const pages = await prisma.page.findMany({
      where: { crawlRunId: runId },
      select: {
        id: true,
        normalizedUrl: true,
        url: true,
        statusCode: true,
        title: true,
        metaDescription: true,
        canonical: true,
        robotsMeta: true,
        h1Count: true,
        wordCount: true,
        htmlHash: true,
        redirectChainJson: true,
        templateId: true,
      },
      orderBy: { id: 'asc' },
      take: PAGE_FETCH_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (pages.length === 0) break;

    for (const page of pages) {
      pageMap.set(page.normalizedUrl, {
        normalizedUrl: page.normalizedUrl,
        url: page.url,
        statusCode: page.statusCode,
        title: page.title,
        metaDescription: page.metaDescription,
        canonical: page.canonical,
        robotsMeta: page.robotsMeta,
        h1Count: page.h1Count,
        wordCount: page.wordCount,
        htmlHash: page.htmlHash,
        redirectChainJson: page.redirectChainJson,
        templateId: page.templateId,
      });
    }

    cursor = pages[pages.length - 1].id;

    if (pages.length < PAGE_FETCH_BATCH) break;
  }

  return pageMap;
}

// ============================================
// Diff Computation
// ============================================

function computeDiffItems(
  fromPages: Map<string, PageSnapshot>,
  toPages: Map<string, PageSnapshot>
): DiffItemInput[] {
  const items: DiffItemInput[] = [];

  // Get union of all normalized URLs
  const allUrls = new Set([...fromPages.keys(), ...toPages.keys()]);

  for (const normalizedUrl of allUrls) {
    const fromPage = fromPages.get(normalizedUrl);
    const toPage = toPages.get(normalizedUrl);

    if (!fromPage && toPage) {
      // NEW_URL - page exists only in toRun
      items.push({
        normalizedUrl,
        url: toPage.url,
        type: DiffType.NEW_URL,
        severity: DiffSeverity.LOW,
        direction: 'IMPROVEMENT',
        beforeJson: null,
        afterJson: pickRelevantFields(toPage, DiffType.NEW_URL),
      });
    } else if (fromPage && !toPage) {
      // REMOVED_URL - page exists only in fromRun
      items.push({
        normalizedUrl,
        url: fromPage.url,
        type: DiffType.REMOVED_URL,
        severity: DiffSeverity.HIGH,
        direction: 'REGRESSION',
        beforeJson: pickRelevantFields(fromPage, DiffType.REMOVED_URL),
        afterJson: null,
      });
    } else if (fromPage && toPage) {
      // Page exists in both - compare fields
      const fieldDiffs = comparePages(fromPage, toPage);
      items.push(...fieldDiffs);
    }
  }

  return items;
}

function comparePages(from: PageSnapshot, to: PageSnapshot): DiffItemInput[] {
  const items: DiffItemInput[] = [];
  const normalizedUrl = from.normalizedUrl;
  const url = to.url;

  // STATUS_CHANGED
  if (from.statusCode !== to.statusCode) {
    const { severity, direction } = computeStatusSeverity(from.statusCode, to.statusCode);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.STATUS_CHANGED,
      severity,
      direction,
      beforeJson: pickRelevantFields(from, DiffType.STATUS_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.STATUS_CHANGED),
    });
  }

  // REDIRECT_CHAIN_CHANGED - use stable stringify for comparison
  const fromChain = stableStringify(from.redirectChainJson ?? null);
  const toChain = stableStringify(to.redirectChainJson ?? null);
  if (fromChain !== toChain) {
    const { severity, direction } = computeRedirectChainSeverity(
      from.redirectChainJson,
      to.redirectChainJson
    );
    items.push({
      normalizedUrl,
      url,
      type: DiffType.REDIRECT_CHAIN_CHANGED,
      severity,
      direction,
      beforeJson: pickRelevantFields(from, DiffType.REDIRECT_CHAIN_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.REDIRECT_CHAIN_CHANGED),
    });
  }

  // TITLE_CHANGED
  if (from.title !== to.title) {
    const { severity, direction } = computeTitleSeverity(from.title, to.title);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.TITLE_CHANGED,
      severity,
      direction,
      beforeJson: pickRelevantFields(from, DiffType.TITLE_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.TITLE_CHANGED),
    });
  }

  // META_DESCRIPTION_CHANGED
  if (from.metaDescription !== to.metaDescription) {
    const { severity, direction } = computeMetaDescriptionSeverity(
      from.metaDescription,
      to.metaDescription
    );
    items.push({
      normalizedUrl,
      url,
      type: DiffType.META_DESCRIPTION_CHANGED,
      severity,
      direction,
      beforeJson: pickRelevantFields(from, DiffType.META_DESCRIPTION_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.META_DESCRIPTION_CHANGED),
    });
  }

  // CANONICAL_CHANGED
  if (from.canonical !== to.canonical) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.CANONICAL_CHANGED,
      severity: DiffSeverity.MEDIUM,
      direction: 'NEUTRAL',
      beforeJson: pickRelevantFields(from, DiffType.CANONICAL_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.CANONICAL_CHANGED),
    });
  }

  // ROBOTS_CHANGED
  if (from.robotsMeta !== to.robotsMeta) {
    const { severity, direction } = computeRobotsSeverity(from.robotsMeta, to.robotsMeta);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.ROBOTS_CHANGED,
      severity,
      direction,
      beforeJson: pickRelevantFields(from, DiffType.ROBOTS_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.ROBOTS_CHANGED),
    });
  }

  // H1_COUNT_CHANGED
  if (from.h1Count !== to.h1Count) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.H1_COUNT_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: pickRelevantFields(from, DiffType.H1_COUNT_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.H1_COUNT_CHANGED),
    });
  }

  // WORDCOUNT_CHANGED - only if significant change
  if (isSignificantWordcountChange(from.wordCount, to.wordCount)) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.WORDCOUNT_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: pickRelevantFields(from, DiffType.WORDCOUNT_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.WORDCOUNT_CHANGED),
    });
  }

  // HTML_HASH_CHANGED
  if (from.htmlHash !== to.htmlHash) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.HTML_HASH_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: pickRelevantFields(from, DiffType.HTML_HASH_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.HTML_HASH_CHANGED),
    });
  }

  // TEMPLATE_CHANGED
  if (from.templateId !== to.templateId) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.TEMPLATE_CHANGED,
      severity: DiffSeverity.MEDIUM,
      direction: 'NEUTRAL',
      beforeJson: pickRelevantFields(from, DiffType.TEMPLATE_CHANGED),
      afterJson: pickRelevantFields(to, DiffType.TEMPLATE_CHANGED),
    });
  }

  return items;
}

// ============================================
// Severity Computation
// ============================================

function computeStatusSeverity(
  fromStatus: number | null,
  toStatus: number | null
): { severity: DiffSeverity; direction: Direction } {
  const from = fromStatus ?? 0;
  const to = toStatus ?? 0;

  // Became error status
  if (to >= 400 && from < 400) {
    return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
  }

  // Fixed from error status
  if (from >= 400 && to < 400) {
    return { severity: DiffSeverity.CRITICAL, direction: 'IMPROVEMENT' };
  }

  // Other status changes
  return { severity: DiffSeverity.HIGH, direction: 'NEUTRAL' };
}

function computeRobotsSeverity(
  fromRobots: string | null,
  toRobots: string | null
): { severity: DiffSeverity; direction: Direction } {
  const fromLower = (fromRobots ?? '').toLowerCase();
  const toLower = (toRobots ?? '').toLowerCase();

  const fromHasNoindex = fromLower.includes('noindex');
  const toHasNoindex = toLower.includes('noindex');

  // Added noindex
  if (!fromHasNoindex && toHasNoindex) {
    return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
  }

  // Removed noindex
  if (fromHasNoindex && !toHasNoindex) {
    return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function computeRedirectChainSeverity(
  fromChain: unknown,
  toChain: unknown
): { severity: DiffSeverity; direction: Direction } {
  const fromLength = Array.isArray(fromChain) ? fromChain.length : 0;
  const toLength = Array.isArray(toChain) ? toChain.length : 0;

  // Chain length increased
  if (toLength > fromLength) {
    return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
  }

  // Chain length decreased
  if (toLength < fromLength) {
    return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
  }

  // Same length but different content
  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function computeTitleSeverity(
  fromTitle: string | null,
  toTitle: string | null
): { severity: DiffSeverity; direction: Direction } {
  const fromEmpty = !fromTitle || fromTitle.trim() === '';
  const toEmpty = !toTitle || toTitle.trim() === '';

  // Title became empty
  if (!fromEmpty && toEmpty) {
    return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
  }

  // Title fixed from empty
  if (fromEmpty && !toEmpty) {
    return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function computeMetaDescriptionSeverity(
  fromDesc: string | null,
  toDesc: string | null
): { severity: DiffSeverity; direction: Direction } {
  const fromEmpty = !fromDesc || fromDesc.trim() === '';
  const toEmpty = !toDesc || toDesc.trim() === '';

  // Description became empty
  if (!fromEmpty && toEmpty) {
    return { severity: DiffSeverity.MEDIUM, direction: 'REGRESSION' };
  }

  // Description added
  if (fromEmpty && !toEmpty) {
    return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.LOW, direction: 'NEUTRAL' };
}

function isSignificantWordcountChange(
  fromCount: number | null,
  toCount: number | null
): boolean {
  const from = fromCount ?? 0;
  const to = toCount ?? 0;

  if (from === to) return false;

  const absDiff = Math.abs(to - from);

  // Absolute threshold
  if (absDiff >= WORDCOUNT_ABS_THRESHOLD) return true;

  // Percentage threshold (avoid division by zero)
  if (from > 0) {
    const percentChange = absDiff / from;
    if (percentChange >= WORDCOUNT_PERCENT_THRESHOLD) return true;
  } else if (to > 0) {
    // from was 0, now has content - significant
    return true;
  }

  return false;
}

// ============================================
// Summary Computation
// ============================================

function computeSummary(items: DiffItemInput[]): DiffSummary {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  let regressions = 0;
  let improvements = 0;
  let neutral = 0;

  const topRegressions: Array<{
    normalizedUrl: string;
    type: DiffType;
    severity: DiffSeverity;
  }> = [];

  for (const item of items) {
    // Count by type
    byType[item.type] = (byType[item.type] ?? 0) + 1;

    // Count by severity
    bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;

    // Count by direction
    if (item.direction === 'REGRESSION') {
      regressions++;
      // Collect for top regressions (CRITICAL or HIGH)
      if (
        item.severity === DiffSeverity.CRITICAL ||
        item.severity === DiffSeverity.HIGH
      ) {
        topRegressions.push({
          normalizedUrl: item.normalizedUrl,
          type: item.type,
          severity: item.severity,
        });
      }
    } else if (item.direction === 'IMPROVEMENT') {
      improvements++;
    } else {
      neutral++;
    }
  }

  // Sort top regressions: CRITICAL first, then HIGH
  topRegressions.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    totalItems: items.length,
    regressions,
    improvements,
    neutral,
    byType,
    bySeverity,
    topRegressions: topRegressions.slice(0, 20),
  };
}

// ============================================
// Database Insert
// ============================================

async function insertItemsInBatches(
  diffId: string,
  items: DiffItemInput[]
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await prisma.crawlDiffItem.createMany({
      data: batch.map((item) => ({
        diffId,
        normalizedUrl: item.normalizedUrl,
        url: item.url,
        type: item.type,
        severity: item.severity,
        direction: item.direction,
        beforeJson: item.beforeJson === null ? Prisma.JsonNull : (item.beforeJson as unknown as Prisma.InputJsonValue),
        afterJson: item.afterJson === null ? Prisma.JsonNull : (item.afterJson as unknown as Prisma.InputJsonValue),
      })),
    });

    logger.debug(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(items.length / BATCH_SIZE)} diff items`);
  }
}
