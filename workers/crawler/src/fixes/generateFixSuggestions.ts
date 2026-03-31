import { PrismaClient, FixType, FixStatus } from '@prisma/client';
import { logger } from '../logger.js';
import { computeFixScores } from './scoreFixSuggestions.js';

/**
 * Maps Issue types to FixType enum values
 */
const ISSUE_TYPE_TO_FIX_TYPE: Record<string, FixType> = {
  DUPLICATE_TITLE: FixType.FIX_TITLE_DUPLICATES,
  MISSING_TITLE: FixType.FIX_MISSING_TITLES,
  TITLE_TOO_SHORT: FixType.FIX_MISSING_TITLES,
  TITLE_TOO_LONG: FixType.FIX_MISSING_TITLES,
  MISSING_META_DESCRIPTION: FixType.FIX_META_DESCRIPTIONS,
  CANONICAL_MISSING: FixType.FIX_CANONICALS,
  H1_MISSING: FixType.FIX_H1_ISSUES,
  H1_MULTIPLE: FixType.FIX_H1_ISSUES,
  THIN_CONTENT: FixType.FIX_THIN_CONTENT,
  IMAGES_MISSING_ALT: FixType.FIX_IMAGE_ALT,
  STATUS_4XX_5XX: FixType.FIX_404_PAGES,
  REDIRECT_CHAIN_LONG: FixType.FIX_REDIRECT_CHAINS,
  ROBOTS_NOINDEX: FixType.FIX_NOINDEX_ACCIDENTAL,
};

/**
 * Maps FixType to human-readable titles and recommendations
 */
const FIX_TYPE_METADATA: Record<
  FixType,
  {
    title: string;
    summaryTemplate: string;
    recommendation: string;
  }
> = {
  [FixType.FIX_TITLE_DUPLICATES]: {
    title: 'Fix Duplicate Page Titles',
    summaryTemplate: '{count} pages share duplicate titles, hurting SEO differentiation and click-through rates.',
    recommendation:
      '1. Identify pages with the same title\n2. Create unique, descriptive titles for each page\n3. Include primary keywords naturally\n4. Keep titles under 60 characters',
  },
  [FixType.FIX_MISSING_TITLES]: {
    title: 'Add Missing or Fix Short/Long Titles',
    summaryTemplate: '{count} pages have missing, too short, or too long titles affecting search visibility.',
    recommendation:
      '1. Add descriptive titles to pages without them\n2. Aim for 50-60 characters\n3. Include target keywords near the beginning\n4. Make titles compelling for users',
  },
  [FixType.FIX_META_DESCRIPTIONS]: {
    title: 'Add Missing Meta Descriptions',
    summaryTemplate: '{count} pages lack meta descriptions, reducing click-through rates from search results.',
    recommendation:
      '1. Write unique descriptions for each page\n2. Keep between 120-155 characters\n3. Include a call-to-action\n4. Incorporate relevant keywords naturally',
  },
  [FixType.FIX_CANONICALS]: {
    title: 'Add Missing Canonical Tags',
    summaryTemplate: '{count} pages lack canonical tags, risking duplicate content issues.',
    recommendation:
      '1. Add self-referencing canonical tags to all pages\n2. Point duplicates to the canonical version\n3. Use absolute URLs\n4. Ensure consistency across templates',
  },
  [FixType.FIX_H1_ISSUES]: {
    title: 'Fix H1 Heading Issues',
    summaryTemplate: '{count} pages have missing or multiple H1 tags, affecting content structure.',
    recommendation:
      '1. Ensure exactly one H1 per page\n2. Make H1 descriptive and keyword-rich\n3. Place H1 early in the content\n4. Use proper heading hierarchy (H1 → H2 → H3)',
  },
  [FixType.FIX_THIN_CONTENT]: {
    title: 'Improve Thin Content Pages',
    summaryTemplate: '{count} pages have thin content (<300 words), which may hurt rankings.',
    recommendation:
      '1. Expand content with valuable information\n2. Aim for at least 300-500 words minimum\n3. Consider consolidating related thin pages\n4. Add multimedia content where appropriate',
  },
  [FixType.FIX_IMAGE_ALT]: {
    title: 'Add Missing Image Alt Text',
    summaryTemplate: '{count} pages have images without alt text, hurting accessibility and image SEO.',
    recommendation:
      '1. Add descriptive alt text to all images\n2. Describe image content accurately\n3. Include keywords where natural\n4. Keep alt text concise (125 characters or less)',
  },
  [FixType.FIX_404_PAGES]: {
    title: 'Fix Broken Pages (4xx/5xx Errors)',
    summaryTemplate: '{count} pages return error status codes, creating poor user experience.',
    recommendation:
      '1. Identify and fix server errors (5xx)\n2. Remove or redirect broken links (4xx)\n3. Set up proper 404 pages\n4. Update internal links pointing to broken URLs',
  },
  [FixType.FIX_REDIRECT_CHAINS]: {
    title: 'Fix Long Redirect Chains',
    summaryTemplate: '{count} URLs have redirect chains (3+ hops), slowing page load and wasting crawl budget.',
    recommendation:
      '1. Update links to point directly to final URLs\n2. Reduce chains to single redirects\n3. Update internal links to avoid redirects\n4. Monitor for new chains after site changes',
  },
  [FixType.FIX_NOINDEX_ACCIDENTAL]: {
    title: 'Review Noindex Pages',
    summaryTemplate: '{count} pages have noindex directives - verify these are intentional.',
    recommendation:
      '1. Audit pages with noindex tags\n2. Remove noindex from pages that should be indexed\n3. Ensure important content is crawlable\n4. Check for conflicting robots directives',
  },
  [FixType.FIX_LCP_REGRESSION]: {
    title: 'Fix LCP Performance Regression',
    summaryTemplate: '{count} pages show LCP (Largest Contentful Paint) regressions affecting Core Web Vitals.',
    recommendation:
      '1. Optimize largest content element loading\n2. Preload critical images/fonts\n3. Use efficient image formats (WebP, AVIF)\n4. Implement server-side rendering if needed',
  },
  [FixType.FIX_CLS_REGRESSION]: {
    title: 'Fix CLS Performance Regression',
    summaryTemplate: '{count} pages show CLS (Cumulative Layout Shift) regressions affecting user experience.',
    recommendation:
      '1. Set explicit dimensions on images/embeds\n2. Reserve space for dynamic content\n3. Avoid inserting content above existing content\n4. Use transform animations instead of layout-triggering properties',
  },
  [FixType.FIX_INP_REGRESSION]: {
    title: 'Fix INP Performance Regression',
    summaryTemplate: '{count} pages show INP (Interaction to Next Paint) regressions affecting responsiveness.',
    recommendation:
      '1. Break up long JavaScript tasks\n2. Optimize event handlers\n3. Use web workers for heavy computation\n4. Implement input debouncing where appropriate',
  },
  [FixType.FIX_UNUSED_JS]: {
    title: 'Remove Unused JavaScript',
    summaryTemplate: '{count} pages load unused JavaScript, slowing initial page load.',
    recommendation:
      '1. Audit JavaScript bundles for unused code\n2. Implement code splitting\n3. Lazy-load non-critical scripts\n4. Remove unused dependencies',
  },
  [FixType.FIX_RENDER_BLOCKING]: {
    title: 'Eliminate Render-Blocking Resources',
    summaryTemplate: '{count} pages have render-blocking resources delaying first paint.',
    recommendation:
      '1. Inline critical CSS\n2. Defer non-critical JavaScript\n3. Use async/defer for scripts\n4. Preload critical resources',
  },
  [FixType.FIX_IMAGE_OPTIMIZATION]: {
    title: 'Optimize Images',
    summaryTemplate: '{count} pages have unoptimized images affecting load time.',
    recommendation:
      '1. Compress images without quality loss\n2. Use modern formats (WebP, AVIF)\n3. Implement responsive images\n4. Lazy-load below-the-fold images',
  },
};

interface IssueAggregate {
  templateId: string | null;
  templateName: string | null;
  issueType: string;
  fixType: FixType;
  severity: string;
  count: number;
  examples: Array<{
    pageId: string;
    url: string;
    normalizedUrl: string;
    issueId: string;
  }>;
}

interface PerfRegressionAggregate {
  templateId: string | null;
  templateName: string | null;
  regressionType: string;
  fixType: FixType;
  severity: string;
  count: number;
  examples: Array<{
    url: string;
    regressionId: string;
    beforeValue: number | null;
    afterValue: number | null;
    delta: number | null;
  }>;
}

/**
 * Groups issues by templateId + type + severity and aggregates counts
 */
async function aggregateIssues(
  prisma: PrismaClient,
  crawlRunId: string,
): Promise<IssueAggregate[]> {
  // Get all issues with their page and template info
  const issues = await prisma.issue.findMany({
    where: { crawlRunId },
    select: {
      id: true,
      type: true,
      severity: true,
      page: {
        select: {
          id: true,
          url: true,
          normalizedUrl: true,
          templateId: true,
          template: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ severity: 'desc' }, { type: 'asc' }],
  });

  // Group by templateId + type
  const groups = new Map<string, IssueAggregate>();

  for (const issue of issues) {
    const fixType = ISSUE_TYPE_TO_FIX_TYPE[issue.type];
    if (!fixType) {
      continue; // Skip issues we don't have a fix type for
    }

    const templateId = issue.page?.templateId ?? null;
    const key = `${templateId ?? 'null'}_${fixType}`;

    if (!groups.has(key)) {
      groups.set(key, {
        templateId,
        templateName: issue.page?.template?.name ?? null,
        issueType: issue.type,
        fixType,
        severity: issue.severity,
        count: 0,
        examples: [],
      });
    }

    const group = groups.get(key)!;
    group.count++;

    // Keep higher severity
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (
      severityOrder[issue.severity as keyof typeof severityOrder] >
      severityOrder[group.severity as keyof typeof severityOrder]
    ) {
      group.severity = issue.severity;
    }

    // Collect up to 10 examples
    if (group.examples.length < 10 && issue.page) {
      group.examples.push({
        pageId: issue.page.id,
        url: issue.page.url,
        normalizedUrl: issue.page.normalizedUrl,
        issueId: issue.id,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Aggregates performance regressions by template and type
 */
async function aggregatePerfRegressions(
  prisma: PrismaClient,
  crawlRunId: string,
): Promise<PerfRegressionAggregate[]> {
  const regressions = await prisma.perfRegressionItem.findMany({
    where: { crawlRunId },
    select: {
      id: true,
      url: true,
      type: true,
      severity: true,
      templateId: true,
      beforeJson: true,
      afterJson: true,
      deltaJson: true,
    },
    orderBy: [{ severity: 'desc' }],
  });

  // Map regression types to fix types
  const REGRESSION_TYPE_TO_FIX: Record<string, FixType> = {
    LCP_REGRESSION: FixType.FIX_LCP_REGRESSION,
    CLS_REGRESSION: FixType.FIX_CLS_REGRESSION,
    INP_REGRESSION: FixType.FIX_INP_REGRESSION,
    TBT_REGRESSION: FixType.FIX_INP_REGRESSION, // TBT maps to INP fix
  };

  const groups = new Map<string, PerfRegressionAggregate>();

  for (const regression of regressions) {
    const fixType = REGRESSION_TYPE_TO_FIX[regression.type];
    if (!fixType) {
      continue;
    }

    const templateId = regression.templateId ?? null;
    const key = `${templateId ?? 'null'}_${fixType}`;

    if (!groups.has(key)) {
      // Get template name
      let templateName: string | null = null;
      if (templateId) {
        const template = await prisma.template.findUnique({
          where: { id: templateId },
          select: { name: true },
        });
        templateName = template?.name ?? null;
      }

      groups.set(key, {
        templateId,
        templateName,
        regressionType: regression.type,
        fixType,
        severity: regression.severity,
        count: 0,
        examples: [],
      });
    }

    const group = groups.get(key)!;
    group.count++;

    // Collect up to 10 examples
    if (group.examples.length < 10) {
      const beforeJson = regression.beforeJson as Record<string, number> | null;
      const afterJson = regression.afterJson as Record<string, number> | null;
      const deltaJson = regression.deltaJson as Record<string, number> | null;

      group.examples.push({
        url: regression.url,
        regressionId: regression.id,
        beforeValue: beforeJson?.value ?? null,
        afterValue: afterJson?.value ?? null,
        delta: deltaJson?.value ?? null,
      });
    }
  }

  return Array.from(groups.values());
}

export interface GenerateFixSuggestionsParams {
  prisma: PrismaClient;
  crawlRunId: string;
  projectId: string;
}

/**
 * Generates fix suggestions for a completed crawl run.
 * Groups issues by template and fix type to create actionable suggestions.
 */
export async function generateFixSuggestions({
  prisma,
  crawlRunId,
  projectId,
}: GenerateFixSuggestionsParams): Promise<{
  suggestionCount: number;
  itemCount: number;
}> {
  logger.info('Generating fix suggestions', { crawlRunId, projectId });

  // Step 1: Delete existing suggestions for idempotency
  await prisma.fixSuggestionItem.deleteMany({
    where: {
      fixSuggestion: {
        crawlRunId,
      },
    },
  });
  await prisma.fixSuggestion.deleteMany({
    where: { crawlRunId },
  });

  // Step 2: Aggregate issues by template + type
  const issueAggregates = await aggregateIssues(prisma, crawlRunId);
  logger.debug('Issue aggregates computed', {
    crawlRunId,
    aggregateCount: issueAggregates.length,
  });

  // Step 3: Aggregate performance regressions
  const perfAggregates = await aggregatePerfRegressions(prisma, crawlRunId);
  logger.debug('Performance regression aggregates computed', {
    crawlRunId,
    aggregateCount: perfAggregates.length,
  });

  let suggestionCount = 0;
  let itemCount = 0;

  // Step 4: Create FixSuggestion rows from issue aggregates
  for (const aggregate of issueAggregates) {
    // Skip if count is too low (noise filtering)
    if (aggregate.count < 1) {
      continue;
    }

    const metadata = FIX_TYPE_METADATA[aggregate.fixType];
    const scores = computeFixScores({
      severity: aggregate.severity,
      fixType: aggregate.fixType,
      affectedPagesCount: aggregate.count,
      isRegression: false,
      templateId: aggregate.templateId,
    });

    // Build title with template context if available
    let title = metadata.title;
    if (aggregate.templateName) {
      title = `${metadata.title} (${aggregate.templateName})`;
    }

    const summary = metadata.summaryTemplate.replace(
      '{count}',
      aggregate.count.toString(),
    );

    const evidenceJson = {
      issueType: aggregate.issueType,
      templateId: aggregate.templateId,
      templateName: aggregate.templateName,
      severity: aggregate.severity,
      examples: aggregate.examples.slice(0, 5).map((e) => ({
        url: e.url,
        pageId: e.pageId,
      })),
    };

    // Create the suggestion
    const suggestion = await prisma.fixSuggestion.create({
      data: {
        crawlRunId,
        projectId,
        templateId: aggregate.templateId,
        fixType: aggregate.fixType,
        status: FixStatus.OPEN,
        priorityScore: scores.priorityScore,
        impactScore: scores.impactScore,
        effortScore: scores.effortScore,
        title,
        summary,
        recommendation: metadata.recommendation,
        evidenceJson,
        affectedPagesCount: aggregate.count,
      },
    });
    suggestionCount++;

    // Step 5: Create FixSuggestionItem rows for examples
    for (const example of aggregate.examples) {
      await prisma.fixSuggestionItem.create({
        data: {
          fixSuggestionId: suggestion.id,
          pageId: example.pageId,
          url: example.url,
          normalizedUrl: example.normalizedUrl,
          issueId: example.issueId,
        },
      });
      itemCount++;
    }
  }

  // Step 6: Create FixSuggestion rows from performance regressions
  for (const aggregate of perfAggregates) {
    if (aggregate.count < 1) {
      continue;
    }

    const metadata = FIX_TYPE_METADATA[aggregate.fixType];
    const scores = computeFixScores({
      severity: aggregate.severity,
      fixType: aggregate.fixType,
      affectedPagesCount: aggregate.count,
      isRegression: true,
      templateId: aggregate.templateId,
    });

    let title = metadata.title;
    if (aggregate.templateName) {
      title = `${metadata.title} (${aggregate.templateName})`;
    }

    const summary = metadata.summaryTemplate.replace(
      '{count}',
      aggregate.count.toString(),
    );

    const evidenceJson = {
      regressionType: aggregate.regressionType,
      templateId: aggregate.templateId,
      templateName: aggregate.templateName,
      severity: aggregate.severity,
      examples: aggregate.examples.slice(0, 5).map((e) => ({
        url: e.url,
        beforeValue: e.beforeValue,
        afterValue: e.afterValue,
        delta: e.delta,
      })),
    };

    const suggestion = await prisma.fixSuggestion.create({
      data: {
        crawlRunId,
        projectId,
        templateId: aggregate.templateId,
        fixType: aggregate.fixType,
        status: FixStatus.OPEN,
        priorityScore: scores.priorityScore,
        impactScore: scores.impactScore,
        effortScore: scores.effortScore,
        title,
        summary,
        recommendation: metadata.recommendation,
        evidenceJson,
        affectedPagesCount: aggregate.count,
      },
    });
    suggestionCount++;

    // Create items for perf regressions
    for (const example of aggregate.examples) {
      await prisma.fixSuggestionItem.create({
        data: {
          fixSuggestionId: suggestion.id,
          url: example.url,
        },
      });
      itemCount++;
    }
  }

  logger.info('Fix suggestions generated', {
    crawlRunId,
    suggestionCount,
    itemCount,
  });

  return { suggestionCount, itemCount };
}
