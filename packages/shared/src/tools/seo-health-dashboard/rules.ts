/**
 * SEO Health Dashboard - Rules Module
 *
 * A comprehensive SEO health check tool that analyzes crawl data and identifies issues
 */

// ============================================
// TYPES
// ============================================

export interface SeoHealthDashboardInput {
  projectId: string;
  crawlRunId: string;
  minSeverity?: string;
  includeWarnings?: boolean;
}

export interface SeoHealthDashboardOutput {
  summary: SeoHealthDashboardSummary;
  results: SeoHealthDashboardResult[];
  generatedAt: string;
}

export interface SeoHealthDashboardSummary {
  healthScore: number;
  totalPages: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  pagesWithIssues: number;
  cleanPagesPct: number;
}

export interface SeoHealthDashboardResult {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  pageUrl: string | null;
  pageId: string | null;
  recommendation: string;
}

export interface RawPageData {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  h1Count: number | null;
  wordCount: number | null;
  canonical: string | null;
}

export interface RawIssueData {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  pageId: string | null;
  pageUrl: string | null;
}

// ============================================
// CONSTANTS
// ============================================

export const SEOHEALTHDASHBOARD_CONFIG = {
  key: 'seo-health-dashboard',
  name: 'SEO Health Dashboard',
  version: '1.0.0',
  category: 'AUDIT',
} as const;

export const DATA_SOURCES = ['PAGES', 'ISSUES'] as const;

const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 10,
  HIGH: 5,
  MEDIUM: 2,
  LOW: 1,
};

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ============================================
// VALIDATION
// ============================================

export function validateSeoHealthDashboardInput(
  input: SeoHealthDashboardInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.projectId) errors.push('Project is required');
  if (!input.crawlRunId) errors.push('Crawl Run is required');
  return { valid: errors.length === 0, errors };
}

// ============================================
// RULES & CALCULATIONS
// ============================================

export function applySeoHealthDashboardRules(
  input: SeoHealthDashboardInput,
  issues: RawIssueData[],
): SeoHealthDashboardResult[] {
  const minSeverityIndex = input.minSeverity
    ? SEVERITY_ORDER.indexOf(input.minSeverity)
    : SEVERITY_ORDER.length - 1;

  return issues
    .filter((issue) => {
      const idx = SEVERITY_ORDER.indexOf(issue.severity);
      return idx >= 0 && idx <= minSeverityIndex;
    })
    .map((issue) => ({
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      pageUrl: issue.pageUrl,
      pageId: issue.pageId,
      recommendation: issue.recommendation,
    }));
}

export function generateSeoHealthDashboardOutput(
  totalPages: number,
  results: SeoHealthDashboardResult[],
): SeoHealthDashboardOutput {
  const criticalIssues = results.filter((r) => r.severity === 'CRITICAL').length;
  const highIssues = results.filter((r) => r.severity === 'HIGH').length;
  const mediumIssues = results.filter((r) => r.severity === 'MEDIUM').length;
  const lowIssues = results.filter((r) => r.severity === 'LOW').length;

  const uniquePagesWithIssues = new Set(
    results.filter((r) => r.pageId).map((r) => r.pageId),
  ).size;

  const cleanPagesPct =
    totalPages > 0
      ? Math.round(((totalPages - uniquePagesWithIssues) / totalPages) * 100)
      : 100;

  // Health score: start at 100, subtract weighted penalty per issue, floor at 0
  const totalWeight = results.reduce(
    (sum, r) => sum + (SEVERITY_WEIGHTS[r.severity] || 0),
    0,
  );
  const maxPenalty = totalPages > 0 ? totalPages * 10 : 100;
  const healthScore = Math.max(
    0,
    Math.round(100 - (totalWeight / maxPenalty) * 100),
  );

  return {
    summary: {
      healthScore,
      totalPages,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      pagesWithIssues: uniquePagesWithIssues,
      cleanPagesPct,
    },
    results,
    generatedAt: new Date().toISOString(),
  };
}
