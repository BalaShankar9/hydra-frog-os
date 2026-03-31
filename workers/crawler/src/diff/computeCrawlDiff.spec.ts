/**
 * Unit tests for Crawl Diff Engine
 *
 * Tests diff classification logic for:
 * - 200 -> 404 (CRITICAL regression)
 * - noindex added (CRITICAL regression)
 * - title fixed (HIGH improvement)
 * - new url (improvement)
 * - removed url (regression)
 */

// Mock the DiffType and DiffSeverity enums to avoid ESM issues
const DiffType = {
  STATUS_CHANGED: 'STATUS_CHANGED',
  REDIRECT_CHAIN_CHANGED: 'REDIRECT_CHAIN_CHANGED',
  TITLE_CHANGED: 'TITLE_CHANGED',
  META_DESCRIPTION_CHANGED: 'META_DESCRIPTION_CHANGED',
  CANONICAL_CHANGED: 'CANONICAL_CHANGED',
  ROBOTS_CHANGED: 'ROBOTS_CHANGED',
  H1_COUNT_CHANGED: 'H1_COUNT_CHANGED',
  WORDCOUNT_CHANGED: 'WORDCOUNT_CHANGED',
  HTML_HASH_CHANGED: 'HTML_HASH_CHANGED',
  TEMPLATE_CHANGED: 'TEMPLATE_CHANGED',
  NEW_URL: 'NEW_URL',
  REMOVED_URL: 'REMOVED_URL',
} as const;

const DiffSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

type DiffTypeValue = typeof DiffType[keyof typeof DiffType];
type DiffSeverityValue = typeof DiffSeverity[keyof typeof DiffSeverity];

// ============================================
// Types for testing (mirror the internal types)
// ============================================

type Direction = 'REGRESSION' | 'IMPROVEMENT' | 'NEUTRAL';

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
  type: DiffTypeValue;
  severity: DiffSeverityValue;
  direction: Direction;
  beforeJson: PageSnapshot | null;
  afterJson: PageSnapshot | null;
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
    type: DiffTypeValue;
    severity: DiffSeverityValue;
  }>;
}

// ============================================
// Pure functions extracted for testing
// ============================================

function computeStatusSeverity(
  fromStatus: number | null,
  toStatus: number | null
): { severity: DiffSeverityValue; direction: Direction } {
  const from = fromStatus ?? 0;
  const to = toStatus ?? 0;

  if (to >= 400 && from < 400) {
    return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
  }

  if (from >= 400 && to < 400) {
    return { severity: DiffSeverity.CRITICAL, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.HIGH, direction: 'NEUTRAL' };
}

function computeRobotsSeverity(
  fromRobots: string | null,
  toRobots: string | null
): { severity: DiffSeverityValue; direction: Direction } {
  const fromLower = (fromRobots ?? '').toLowerCase();
  const toLower = (toRobots ?? '').toLowerCase();

  const fromHasNoindex = fromLower.includes('noindex');
  const toHasNoindex = toLower.includes('noindex');

  if (!fromHasNoindex && toHasNoindex) {
    return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
  }

  if (fromHasNoindex && !toHasNoindex) {
    return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function computeTitleSeverity(
  fromTitle: string | null,
  toTitle: string | null
): { severity: DiffSeverityValue; direction: Direction } {
  const fromEmpty = !fromTitle || fromTitle.trim() === '';
  const toEmpty = !toTitle || toTitle.trim() === '';

  if (!fromEmpty && toEmpty) {
    return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
  }

  if (fromEmpty && !toEmpty) {
    return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function computeMetaDescriptionSeverity(
  fromDesc: string | null,
  toDesc: string | null
): { severity: DiffSeverityValue; direction: Direction } {
  const fromEmpty = !fromDesc || fromDesc.trim() === '';
  const toEmpty = !toDesc || toDesc.trim() === '';

  if (!fromEmpty && toEmpty) {
    return { severity: DiffSeverity.MEDIUM, direction: 'REGRESSION' };
  }

  if (fromEmpty && !toEmpty) {
    return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.LOW, direction: 'NEUTRAL' };
}

function computeRedirectChainSeverity(
  fromChain: unknown,
  toChain: unknown
): { severity: DiffSeverityValue; direction: Direction } {
  const fromLength = Array.isArray(fromChain) ? fromChain.length : 0;
  const toLength = Array.isArray(toChain) ? toChain.length : 0;

  if (toLength > fromLength) {
    return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
  }

  if (toLength < fromLength) {
    return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
  }

  return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
}

function isSignificantWordcountChange(
  fromCount: number | null,
  toCount: number | null
): boolean {
  const from = fromCount ?? 0;
  const to = toCount ?? 0;

  if (from === to) return false;

  const absDiff = Math.abs(to - from);

  if (absDiff >= 200) return true;

  if (from > 0) {
    const percentChange = absDiff / from;
    if (percentChange >= 0.2) return true;
  } else if (to > 0) {
    return true;
  }

  return false;
}

function createBasePage(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    normalizedUrl: 'example.com/page',
    url: 'https://example.com/page',
    statusCode: 200,
    title: 'Test Page',
    metaDescription: 'Test description',
    canonical: 'https://example.com/page',
    robotsMeta: null,
    h1Count: 1,
    wordCount: 500,
    htmlHash: 'abc123',
    redirectChainJson: null,
    templateId: null,
    ...overrides,
  };
}

function comparePages(from: PageSnapshot, to: PageSnapshot): DiffItemInput[] {
  const items: DiffItemInput[] = [];
  const normalizedUrl = from.normalizedUrl;
  const url = to.url;

  if (from.statusCode !== to.statusCode) {
    const { severity, direction } = computeStatusSeverity(from.statusCode, to.statusCode);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.STATUS_CHANGED,
      severity,
      direction,
      beforeJson: from,
      afterJson: to,
    });
  }

  const fromChain = JSON.stringify(from.redirectChainJson ?? null);
  const toChain = JSON.stringify(to.redirectChainJson ?? null);
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
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.title !== to.title) {
    const { severity, direction } = computeTitleSeverity(from.title, to.title);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.TITLE_CHANGED,
      severity,
      direction,
      beforeJson: from,
      afterJson: to,
    });
  }

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
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.canonical !== to.canonical) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.CANONICAL_CHANGED,
      severity: DiffSeverity.MEDIUM,
      direction: 'NEUTRAL',
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.robotsMeta !== to.robotsMeta) {
    const { severity, direction } = computeRobotsSeverity(from.robotsMeta, to.robotsMeta);
    items.push({
      normalizedUrl,
      url,
      type: DiffType.ROBOTS_CHANGED,
      severity,
      direction,
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.h1Count !== to.h1Count) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.H1_COUNT_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: from,
      afterJson: to,
    });
  }

  if (isSignificantWordcountChange(from.wordCount, to.wordCount)) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.WORDCOUNT_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.htmlHash !== to.htmlHash) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.HTML_HASH_CHANGED,
      severity: DiffSeverity.LOW,
      direction: 'NEUTRAL',
      beforeJson: from,
      afterJson: to,
    });
  }

  if (from.templateId !== to.templateId) {
    items.push({
      normalizedUrl,
      url,
      type: DiffType.TEMPLATE_CHANGED,
      severity: DiffSeverity.MEDIUM,
      direction: 'NEUTRAL',
      beforeJson: from,
      afterJson: to,
    });
  }

  return items;
}

function computeDiffItems(
  fromPages: Map<string, PageSnapshot>,
  toPages: Map<string, PageSnapshot>
): DiffItemInput[] {
  const items: DiffItemInput[] = [];
  const allUrls = new Set([...fromPages.keys(), ...toPages.keys()]);

  for (const normalizedUrl of allUrls) {
    const fromPage = fromPages.get(normalizedUrl);
    const toPage = toPages.get(normalizedUrl);

    if (!fromPage && toPage) {
      items.push({
        normalizedUrl,
        url: toPage.url,
        type: DiffType.NEW_URL,
        severity: DiffSeverity.LOW,
        direction: 'IMPROVEMENT',
        beforeJson: null,
        afterJson: toPage,
      });
    } else if (fromPage && !toPage) {
      items.push({
        normalizedUrl,
        url: fromPage.url,
        type: DiffType.REMOVED_URL,
        severity: DiffSeverity.HIGH,
        direction: 'REGRESSION',
        beforeJson: fromPage,
        afterJson: null,
      });
    } else if (fromPage && toPage) {
      const fieldDiffs = comparePages(fromPage, toPage);
      items.push(...fieldDiffs);
    }
  }

  return items;
}

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
    type: DiffTypeValue;
    severity: DiffSeverityValue;
  }> = [];

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;

    if (item.direction === 'REGRESSION') {
      regressions++;
      if (item.severity === DiffSeverity.CRITICAL || item.severity === DiffSeverity.HIGH) {
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

  topRegressions.sort((a, b) => {
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
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
// Tests
// ============================================

describe('Crawl Diff Engine', () => {
  describe('Status Code Changes', () => {
    it('should detect 200 -> 404 as CRITICAL regression', () => {
      const result = computeStatusSeverity(200, 404);
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect 200 -> 500 as CRITICAL regression', () => {
      const result = computeStatusSeverity(200, 500);
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect 404 -> 200 as CRITICAL improvement', () => {
      const result = computeStatusSeverity(404, 200);
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect 301 -> 200 as HIGH neutral', () => {
      const result = computeStatusSeverity(301, 200);
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('NEUTRAL');
    });

    it('should detect null -> 404 as CRITICAL regression', () => {
      const result = computeStatusSeverity(null, 404);
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('REGRESSION');
    });
  });

  describe('Robots Meta Changes', () => {
    it('should detect noindex added as CRITICAL regression', () => {
      const result = computeRobotsSeverity(null, 'noindex, nofollow');
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect noindex added (case insensitive) as CRITICAL regression', () => {
      const result = computeRobotsSeverity('index, follow', 'NOINDEX, follow');
      expect(result.severity).toBe(DiffSeverity.CRITICAL);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect noindex removed as HIGH improvement', () => {
      const result = computeRobotsSeverity('noindex', 'index, follow');
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect other robots changes as MEDIUM neutral', () => {
      const result = computeRobotsSeverity('nofollow', 'index, follow');
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('NEUTRAL');
    });
  });

  describe('Title Changes', () => {
    it('should detect title fixed from empty as HIGH improvement', () => {
      const result = computeTitleSeverity('', 'New Title');
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect title fixed from null as HIGH improvement', () => {
      const result = computeTitleSeverity(null, 'New Title');
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect title removed as HIGH regression', () => {
      const result = computeTitleSeverity('Old Title', '');
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect title changed as MEDIUM neutral', () => {
      const result = computeTitleSeverity('Old Title', 'New Title');
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('NEUTRAL');
    });
  });

  describe('Meta Description Changes', () => {
    it('should detect description added as MEDIUM improvement', () => {
      const result = computeMetaDescriptionSeverity(null, 'New description');
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect description removed as MEDIUM regression', () => {
      const result = computeMetaDescriptionSeverity('Old description', '');
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect description changed as LOW neutral', () => {
      const result = computeMetaDescriptionSeverity('Old', 'New');
      expect(result.severity).toBe(DiffSeverity.LOW);
      expect(result.direction).toBe('NEUTRAL');
    });
  });

  describe('Redirect Chain Changes', () => {
    it('should detect redirect chain added as HIGH regression', () => {
      const result = computeRedirectChainSeverity(null, ['https://a.com', 'https://b.com']);
      expect(result.severity).toBe(DiffSeverity.HIGH);
      expect(result.direction).toBe('REGRESSION');
    });

    it('should detect redirect chain shortened as MEDIUM improvement', () => {
      const result = computeRedirectChainSeverity(
        ['https://a.com', 'https://b.com', 'https://c.com'],
        ['https://a.com']
      );
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('IMPROVEMENT');
    });

    it('should detect redirect chain same length different content as MEDIUM neutral', () => {
      const result = computeRedirectChainSeverity(
        ['https://a.com'],
        ['https://b.com']
      );
      expect(result.severity).toBe(DiffSeverity.MEDIUM);
      expect(result.direction).toBe('NEUTRAL');
    });
  });

  describe('Word Count Changes', () => {
    it('should detect significant word count decrease (>200 words)', () => {
      expect(isSignificantWordcountChange(1000, 700)).toBe(true);
    });

    it('should detect significant word count increase (>20%)', () => {
      expect(isSignificantWordcountChange(500, 650)).toBe(true);
    });

    it('should not flag small word count changes', () => {
      expect(isSignificantWordcountChange(1000, 950)).toBe(false);
    });

    it('should detect content added from empty', () => {
      expect(isSignificantWordcountChange(0, 100)).toBe(true);
    });

    it('should handle null values', () => {
      expect(isSignificantWordcountChange(null, 250)).toBe(true);
      expect(isSignificantWordcountChange(1000, null)).toBe(true);
    });
  });

  describe('Full Page Comparison', () => {
    it('should detect multiple changes on same page', () => {
      const fromPage = createBasePage({
        statusCode: 200,
        title: '',
        robotsMeta: null,
      });
      const toPage = createBasePage({
        statusCode: 404,
        title: 'Fixed Title',
        robotsMeta: 'noindex',
      });

      const diffs = comparePages(fromPage, toPage);

      expect(diffs.length).toBeGreaterThanOrEqual(3);

      const statusDiff = diffs.find((d) => d.type === DiffType.STATUS_CHANGED);
      expect(statusDiff?.severity).toBe(DiffSeverity.CRITICAL);
      expect(statusDiff?.direction).toBe('REGRESSION');

      const titleDiff = diffs.find((d) => d.type === DiffType.TITLE_CHANGED);
      expect(titleDiff?.severity).toBe(DiffSeverity.HIGH);
      expect(titleDiff?.direction).toBe('IMPROVEMENT');

      const robotsDiff = diffs.find((d) => d.type === DiffType.ROBOTS_CHANGED);
      expect(robotsDiff?.severity).toBe(DiffSeverity.CRITICAL);
      expect(robotsDiff?.direction).toBe('REGRESSION');
    });
  });

  describe('Diff Items Computation', () => {
    it('should detect new URL as improvement', () => {
      const fromPages = new Map<string, PageSnapshot>();
      const toPages = new Map<string, PageSnapshot>();

      toPages.set('example.com/new', createBasePage({
        normalizedUrl: 'example.com/new',
        url: 'https://example.com/new',
      }));

      const items = computeDiffItems(fromPages, toPages);

      expect(items.length).toBe(1);
      expect(items[0].type).toBe(DiffType.NEW_URL);
      expect(items[0].severity).toBe(DiffSeverity.LOW);
      expect(items[0].direction).toBe('IMPROVEMENT');
    });

    it('should detect removed URL as regression', () => {
      const fromPages = new Map<string, PageSnapshot>();
      const toPages = new Map<string, PageSnapshot>();

      fromPages.set('example.com/old', createBasePage({
        normalizedUrl: 'example.com/old',
        url: 'https://example.com/old',
      }));

      const items = computeDiffItems(fromPages, toPages);

      expect(items.length).toBe(1);
      expect(items[0].type).toBe(DiffType.REMOVED_URL);
      expect(items[0].severity).toBe(DiffSeverity.HIGH);
      expect(items[0].direction).toBe('REGRESSION');
    });

    it('should handle complex scenario with multiple pages', () => {
      const fromPages = new Map<string, PageSnapshot>();
      const toPages = new Map<string, PageSnapshot>();

      // Page 1: 200 -> 404 (CRITICAL regression)
      fromPages.set('example.com/page1', createBasePage({
        normalizedUrl: 'example.com/page1',
        statusCode: 200,
      }));
      toPages.set('example.com/page1', createBasePage({
        normalizedUrl: 'example.com/page1',
        statusCode: 404,
      }));

      // Page 2: noindex added (CRITICAL regression)
      fromPages.set('example.com/page2', createBasePage({
        normalizedUrl: 'example.com/page2',
        robotsMeta: null,
      }));
      toPages.set('example.com/page2', createBasePage({
        normalizedUrl: 'example.com/page2',
        robotsMeta: 'noindex',
      }));

      // Page 3: title fixed (HIGH improvement)
      fromPages.set('example.com/page3', createBasePage({
        normalizedUrl: 'example.com/page3',
        title: '',
      }));
      toPages.set('example.com/page3', createBasePage({
        normalizedUrl: 'example.com/page3',
        title: 'New Title',
      }));

      // Page 4: new URL (improvement)
      toPages.set('example.com/new', createBasePage({
        normalizedUrl: 'example.com/new',
      }));

      // Page 5: removed URL (regression)
      fromPages.set('example.com/removed', createBasePage({
        normalizedUrl: 'example.com/removed',
      }));

      const items = computeDiffItems(fromPages, toPages);

      const statusChanges = items.filter((i) => i.type === DiffType.STATUS_CHANGED);
      const robotsChanges = items.filter((i) => i.type === DiffType.ROBOTS_CHANGED);
      const titleChanges = items.filter((i) => i.type === DiffType.TITLE_CHANGED);
      const newUrls = items.filter((i) => i.type === DiffType.NEW_URL);
      const removedUrls = items.filter((i) => i.type === DiffType.REMOVED_URL);

      expect(statusChanges.length).toBe(1);
      expect(statusChanges[0].severity).toBe(DiffSeverity.CRITICAL);
      expect(statusChanges[0].direction).toBe('REGRESSION');

      expect(robotsChanges.length).toBe(1);
      expect(robotsChanges[0].severity).toBe(DiffSeverity.CRITICAL);
      expect(robotsChanges[0].direction).toBe('REGRESSION');

      expect(titleChanges.length).toBe(1);
      expect(titleChanges[0].severity).toBe(DiffSeverity.HIGH);
      expect(titleChanges[0].direction).toBe('IMPROVEMENT');

      expect(newUrls.length).toBe(1);
      expect(newUrls[0].direction).toBe('IMPROVEMENT');

      expect(removedUrls.length).toBe(1);
      expect(removedUrls[0].direction).toBe('REGRESSION');
    });
  });

  describe('Summary Computation', () => {
    it('should correctly count regressions, improvements, and neutral', () => {
      const items: DiffItemInput[] = [
        {
          normalizedUrl: 'a',
          url: 'a',
          type: DiffType.STATUS_CHANGED,
          severity: DiffSeverity.CRITICAL,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'b',
          url: 'b',
          type: DiffType.ROBOTS_CHANGED,
          severity: DiffSeverity.CRITICAL,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'c',
          url: 'c',
          type: DiffType.TITLE_CHANGED,
          severity: DiffSeverity.HIGH,
          direction: 'IMPROVEMENT',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'd',
          url: 'd',
          type: DiffType.NEW_URL,
          severity: DiffSeverity.LOW,
          direction: 'IMPROVEMENT',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'e',
          url: 'e',
          type: DiffType.CANONICAL_CHANGED,
          severity: DiffSeverity.MEDIUM,
          direction: 'NEUTRAL',
          beforeJson: null,
          afterJson: null,
        },
      ];

      const summary = computeSummary(items);

      expect(summary.totalItems).toBe(5);
      expect(summary.regressions).toBe(2);
      expect(summary.improvements).toBe(2);
      expect(summary.neutral).toBe(1);
      expect(summary.bySeverity.CRITICAL).toBe(2);
      expect(summary.bySeverity.HIGH).toBe(1);
      expect(summary.bySeverity.MEDIUM).toBe(1);
      expect(summary.bySeverity.LOW).toBe(1);
    });

    it('should collect top regressions sorted by severity', () => {
      const items: DiffItemInput[] = [
        {
          normalizedUrl: 'high1',
          url: 'high1',
          type: DiffType.REMOVED_URL,
          severity: DiffSeverity.HIGH,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'critical1',
          url: 'critical1',
          type: DiffType.STATUS_CHANGED,
          severity: DiffSeverity.CRITICAL,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        },
        {
          normalizedUrl: 'high2',
          url: 'high2',
          type: DiffType.TITLE_CHANGED,
          severity: DiffSeverity.HIGH,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        },
      ];

      const summary = computeSummary(items);

      expect(summary.topRegressions.length).toBe(3);
      expect(summary.topRegressions[0].severity).toBe(DiffSeverity.CRITICAL);
      expect(summary.topRegressions[1].severity).toBe(DiffSeverity.HIGH);
      expect(summary.topRegressions[2].severity).toBe(DiffSeverity.HIGH);
    });

    it('should limit topRegressions to 20', () => {
      const items: DiffItemInput[] = [];
      for (let i = 0; i < 30; i++) {
        items.push({
          normalizedUrl: `url${i}`,
          url: `url${i}`,
          type: DiffType.STATUS_CHANGED,
          severity: DiffSeverity.CRITICAL,
          direction: 'REGRESSION',
          beforeJson: null,
          afterJson: null,
        });
      }

      const summary = computeSummary(items);

      expect(summary.topRegressions.length).toBe(20);
    });
  });

  describe('Performance - Large Crawls', () => {
    it('should handle 10k URLs efficiently', () => {
      const fromPages = new Map<string, PageSnapshot>();
      const toPages = new Map<string, PageSnapshot>();

      const startSetup = Date.now();

      for (let i = 0; i < 10000; i++) {
        const normalizedUrl = `example.com/page-${i}`;
        fromPages.set(normalizedUrl, createBasePage({
          normalizedUrl,
          url: `https://${normalizedUrl}`,
          statusCode: 200,
          title: `Page ${i}`,
        }));
      }

      for (let i = 0; i < 10000; i++) {
        const normalizedUrl = `example.com/page-${i}`;
        const statusCode = i % 10 === 0 ? 404 : 200;
        const title = i % 5 === 0 ? `Updated Page ${i}` : `Page ${i}`;

        toPages.set(normalizedUrl, createBasePage({
          normalizedUrl,
          url: `https://${normalizedUrl}`,
          statusCode,
          title,
        }));
      }

      const setupTime = Date.now() - startSetup;

      const startCompute = Date.now();
      const items = computeDiffItems(fromPages, toPages);
      const computeTime = Date.now() - startCompute;

      const startSummary = Date.now();
      const summary = computeSummary(items);
      const summaryTime = Date.now() - startSummary;

      expect(setupTime + computeTime + summaryTime).toBeLessThan(5000);

      const statusChanges = items.filter((i) => i.type === DiffType.STATUS_CHANGED);
      expect(statusChanges.length).toBe(1000);

      const titleChanges = items.filter((i) => i.type === DiffType.TITLE_CHANGED);
      expect(titleChanges.length).toBe(2000);

      expect(summary.totalItems).toBeGreaterThan(0);
    });
  });
});
