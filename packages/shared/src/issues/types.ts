/**
 * Issue Types - Categorized problems detected during page analysis
 */
export const IssueType = {
  // HTTP Status Issues
  STATUS_4XX_5XX: 'STATUS_4XX_5XX',
  STATUS_3XX_REDIRECT: 'STATUS_3XX_REDIRECT',
  REDIRECT_CHAIN_LONG: 'REDIRECT_CHAIN_LONG',

  // Title Issues
  MISSING_TITLE: 'MISSING_TITLE',
  DUPLICATE_TITLE: 'DUPLICATE_TITLE',
  TITLE_TOO_LONG: 'TITLE_TOO_LONG',
  TITLE_TOO_SHORT: 'TITLE_TOO_SHORT',

  // Meta Issues
  MISSING_META_DESCRIPTION: 'MISSING_META_DESCRIPTION',

  // Heading Issues
  H1_MISSING: 'H1_MISSING',
  H1_MULTIPLE: 'H1_MULTIPLE',

  // Technical SEO Issues
  CANONICAL_MISSING: 'CANONICAL_MISSING',
  ROBOTS_NOINDEX: 'ROBOTS_NOINDEX',

  // Content Issues
  THIN_CONTENT: 'THIN_CONTENT',

  // Accessibility Issues
  IMAGES_MISSING_ALT: 'IMAGES_MISSING_ALT',
} as const;

export type IssueType = (typeof IssueType)[keyof typeof IssueType];

/**
 * Severity levels for issues
 */
export const Severity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type Severity = (typeof Severity)[keyof typeof Severity];

/**
 * Draft shape for creating issues - used before persisting to database
 */
export interface IssueDraft {
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  evidenceJson?: Record<string, unknown>;
}

/**
 * Input shape for page analysis - matches relevant Page model fields
 */
export interface PageAnalysisInput {
  statusCode?: number | null;
  title?: string | null;
  metaDescription?: string | null;
  h1Count?: number | null;
  canonical?: string | null;
  robotsMeta?: string | null;
  wordCount?: number | null;
  redirectChainJson?: unknown | null;
}

/**
 * Extra analysis input not stored directly on Page
 */
export interface ExtraAnalysisInput {
  imagesMissingAlt?: number;
}
