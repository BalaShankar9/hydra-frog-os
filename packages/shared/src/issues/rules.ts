import {
  IssueType,
  Severity,
  IssueDraft,
  PageAnalysisInput,
  ExtraAnalysisInput,
} from './types.js';

/**
 * Rule definition for page analysis
 */
interface RuleDefinition {
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  evaluate: (
    page: PageAnalysisInput,
    extra?: ExtraAnalysisInput
  ) => { triggered: boolean; evidence: Record<string, unknown> };
}

/**
 * All issue rules - Phase 1
 */
const RULES: RuleDefinition[] = [
  // HTTP Status Issues
  {
    type: IssueType.STATUS_4XX_5XX,
    severity: Severity.CRITICAL,
    title: 'Page returns error status code',
    description:
      'This page returned an HTTP 4xx or 5xx error status code, meaning it is broken or unavailable.',
    recommendation:
      'Fix the server error or update/remove links pointing to this URL.',
    evaluate: (page) => {
      const statusCode = page.statusCode ?? 0;
      const triggered = statusCode >= 400;
      return { triggered, evidence: { statusCode } };
    },
  },
  {
    type: IssueType.STATUS_3XX_REDIRECT,
    severity: Severity.MEDIUM,
    title: 'Page redirects to another URL',
    description:
      'This page returns a 3xx redirect status code instead of serving content directly.',
    recommendation:
      'Update internal links to point directly to the final destination URL.',
    evaluate: (page) => {
      const statusCode = page.statusCode ?? 0;
      const triggered = statusCode >= 300 && statusCode < 400;
      return { triggered, evidence: { statusCode } };
    },
  },
  {
    type: IssueType.REDIRECT_CHAIN_LONG,
    severity: Severity.HIGH,
    title: 'Long redirect chain detected',
    description:
      'This page goes through 3 or more redirects before reaching the final destination, which slows down page load.',
    recommendation:
      'Reduce redirect chains by updating links to point directly to the final URL.',
    evaluate: (page) => {
      let chainLength = 0;
      if (page.redirectChainJson) {
        const chain = Array.isArray(page.redirectChainJson)
          ? page.redirectChainJson
          : [];
        chainLength = chain.length;
      }
      const triggered = chainLength >= 3;
      return { triggered, evidence: { redirectChainLength: chainLength } };
    },
  },

  // Title Issues
  {
    type: IssueType.MISSING_TITLE,
    severity: Severity.HIGH,
    title: 'Missing page title',
    description:
      'This page is missing a <title> tag, which is critical for SEO and user experience.',
    recommendation:
      'Add a unique, descriptive <title> tag between 30-60 characters.',
    evaluate: (page) => {
      const title = page.title?.trim() ?? '';
      const triggered = title.length === 0;
      return { triggered, evidence: { title: page.title ?? null } };
    },
  },
  {
    type: IssueType.TITLE_TOO_LONG,
    severity: Severity.LOW,
    title: 'Page title is too long',
    description:
      'The title tag exceeds 60 characters and may be truncated in search results.',
    recommendation:
      'Shorten the title to 60 characters or less to ensure it displays fully.',
    evaluate: (page) => {
      const title = page.title?.trim() ?? '';
      const triggered = title.length > 60;
      return { triggered, evidence: { titleLength: title.length, title } };
    },
  },
  {
    type: IssueType.TITLE_TOO_SHORT,
    severity: Severity.LOW,
    title: 'Page title is too short',
    description:
      'The title tag has fewer than 10 characters, which may not be descriptive enough.',
    recommendation:
      'Expand the title to at least 30 characters with relevant keywords.',
    evaluate: (page) => {
      const title = page.title?.trim() ?? '';
      // Only trigger if there IS a title but it's too short
      const triggered = title.length > 0 && title.length < 10;
      return { triggered, evidence: { titleLength: title.length, title } };
    },
  },

  // Meta Issues
  {
    type: IssueType.MISSING_META_DESCRIPTION,
    severity: Severity.MEDIUM,
    title: 'Missing meta description',
    description:
      'This page is missing a meta description, which search engines use as the snippet in results.',
    recommendation:
      'Add a meta description between 120-160 characters summarizing the page content.',
    evaluate: (page) => {
      const metaDescription = page.metaDescription?.trim() ?? '';
      const triggered = metaDescription.length === 0;
      return {
        triggered,
        evidence: { metaDescription: page.metaDescription ?? null },
      };
    },
  },

  // Heading Issues
  {
    type: IssueType.H1_MISSING,
    severity: Severity.HIGH,
    title: 'Missing H1 heading',
    description:
      'This page has no H1 heading, which is important for content structure and SEO.',
    recommendation:
      'Add exactly one H1 heading that describes the main topic of the page.',
    evaluate: (page) => {
      const h1Count = page.h1Count ?? 0;
      const triggered = h1Count === 0;
      return { triggered, evidence: { h1Count } };
    },
  },
  {
    type: IssueType.H1_MULTIPLE,
    severity: Severity.LOW,
    title: 'Multiple H1 headings',
    description:
      'This page has more than one H1 heading, which can confuse search engines about the main topic.',
    recommendation:
      'Use only one H1 heading per page and use H2-H6 for subheadings.',
    evaluate: (page) => {
      const h1Count = page.h1Count ?? 0;
      const triggered = h1Count > 1;
      return { triggered, evidence: { h1Count } };
    },
  },

  // Technical SEO Issues
  {
    type: IssueType.CANONICAL_MISSING,
    severity: Severity.LOW,
    title: 'Missing canonical tag',
    description:
      'This page is missing a canonical URL tag, which helps prevent duplicate content issues.',
    recommendation:
      'Add a <link rel="canonical"> tag pointing to the preferred version of this page.',
    evaluate: (page) => {
      const canonical = page.canonical?.trim() ?? '';
      const triggered = canonical.length === 0;
      return { triggered, evidence: { canonical: page.canonical ?? null } };
    },
  },
  {
    type: IssueType.ROBOTS_NOINDEX,
    severity: Severity.MEDIUM,
    title: 'Page blocked from indexing',
    description:
      'This page has a "noindex" directive in the robots meta tag, preventing search engines from indexing it.',
    recommendation:
      'Remove "noindex" if you want this page to appear in search results.',
    evaluate: (page) => {
      const robotsMeta = page.robotsMeta?.toLowerCase() ?? '';
      const triggered = robotsMeta.includes('noindex');
      return {
        triggered,
        evidence: { robotsMeta: page.robotsMeta ?? null },
      };
    },
  },

  // Content Issues
  {
    type: IssueType.THIN_CONTENT,
    severity: Severity.LOW,
    title: 'Thin content detected',
    description:
      'This page has fewer than 150 words, which may be considered low-quality content.',
    recommendation:
      'Add more valuable content to reach at least 300-500 words for better SEO.',
    evaluate: (page) => {
      const wordCount = page.wordCount;
      // Only trigger if wordCount is defined
      const triggered = wordCount != null && wordCount < 150;
      return { triggered, evidence: { wordCount: wordCount ?? null } };
    },
  },

  // Accessibility Issues
  {
    type: IssueType.IMAGES_MISSING_ALT,
    severity: Severity.LOW,
    title: 'Images missing alt text',
    description:
      'One or more images on this page are missing alt attributes, reducing accessibility.',
    recommendation:
      'Add descriptive alt text to all images for screen readers and SEO.',
    evaluate: (_page, extra) => {
      const imagesMissingAlt = extra?.imagesMissingAlt ?? 0;
      const triggered = imagesMissingAlt > 0;
      return { triggered, evidence: { imagesMissingAlt } };
    },
  },
];

/**
 * Evaluate all rules against a page and return triggered issues
 *
 * @param page - Page data to analyze
 * @param extra - Additional analysis data not on Page model
 * @returns Array of IssueDraft objects for issues found
 */
export function evaluatePageIssues(
  page: PageAnalysisInput,
  extra?: ExtraAnalysisInput
): IssueDraft[] {
  const issues: IssueDraft[] = [];

  for (const rule of RULES) {
    const { triggered, evidence } = rule.evaluate(page, extra);

    if (triggered) {
      issues.push({
        type: rule.type,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        recommendation: rule.recommendation,
        evidenceJson: evidence,
      });
    }
  }

  return issues;
}

/**
 * Get all available rule definitions (for documentation/UI)
 */
export function getAllRules(): ReadonlyArray<
  Omit<RuleDefinition, 'evaluate'>
> {
  return RULES.map(({ evaluate: _evaluate, ...rest }) => rest);
}

/**
 * Get rule by type
 */
export function getRuleByType(
  type: IssueType
): Omit<RuleDefinition, 'evaluate'> | undefined {
  const rule = RULES.find((r) => r.type === type);
  if (!rule) return undefined;
  const { evaluate: _evaluate, ...rest } = rule;
  return rest;
}
