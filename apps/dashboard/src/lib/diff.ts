/**
 * Diff API Types and Utilities
 */

import { apiFetch } from './api';

// ============================================
// Types
// ============================================

export type DiffType =
  | 'NEW_URL'
  | 'REMOVED_URL'
  | 'STATUS_CHANGED'
  | 'REDIRECT_CHAIN_CHANGED'
  | 'TITLE_CHANGED'
  | 'META_DESCRIPTION_CHANGED'
  | 'CANONICAL_CHANGED'
  | 'ROBOTS_CHANGED'
  | 'H1_COUNT_CHANGED'
  | 'WORDCOUNT_CHANGED'
  | 'HTML_HASH_CHANGED'
  | 'TEMPLATE_CHANGED'
  | 'ISSUE_COUNT_CHANGED';

export type DiffSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DiffDirection = 'REGRESSION' | 'IMPROVEMENT' | 'NEUTRAL';

export interface DiffSummaryJson {
  totalItems: number;
  regressions: number;
  improvements: number;
  neutral: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topRegressions: Array<{
    normalizedUrl: string;
    type: string;
    severity: string;
  }>;
}

export interface DiffResponse {
  diffId: string;
  projectId: string;
  fromRunId: string;
  toRunId: string;
  createdAt: string;
  summaryJson: DiffSummaryJson | null;
}

export interface DiffItem {
  id: string;
  normalizedUrl: string;
  url: string;
  type: DiffType;
  severity: DiffSeverity;
  direction: DiffDirection;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface DiffItemsListResponse {
  items: DiffItem[];
  total: number;
}

export interface CompareResponse {
  diffId: string;
  summaryJson: DiffSummaryJson | null;
  isNew: boolean;
}

export interface ListDiffItemsParams {
  type?: DiffType;
  severity?: DiffSeverity;
  direction?: DiffDirection;
  q?: string;
  page?: number;
  pageSize?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch diff for a crawl run
 */
export async function fetchDiffForCrawlRun(toRunId: string): Promise<DiffResponse | null> {
  try {
    return await apiFetch<DiffResponse>(`/crawls/${toRunId}/diff`);
  } catch (error) {
    // 404 means no diff exists
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch diff by ID
 */
export async function fetchDiffById(diffId: string): Promise<DiffResponse> {
  return apiFetch<DiffResponse>(`/diffs/${diffId}`);
}

/**
 * Fetch diff items with pagination and filtering
 */
export async function fetchDiffItems(
  diffId: string,
  params: ListDiffItemsParams = {}
): Promise<DiffItemsListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params.type) queryParams.set('type', params.type);
  if (params.severity) queryParams.set('severity', params.severity);
  if (params.direction) queryParams.set('direction', params.direction);
  if (params.q) queryParams.set('q', params.q);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));
  
  const queryString = queryParams.toString();
  const url = `/diffs/${diffId}/items${queryString ? `?${queryString}` : ''}`;
  
  return apiFetch<DiffItemsListResponse>(url);
}

/**
 * Compare two crawl runs
 */
export async function compareRuns(
  projectId: string,
  fromRunId: string,
  toRunId: string
): Promise<CompareResponse> {
  return apiFetch<CompareResponse>(`/projects/${projectId}/compare`, {
    method: 'POST',
    body: { fromRunId, toRunId },
  });
}

// ============================================
// Helpers
// ============================================

export const DIFF_TYPE_LABELS: Record<DiffType, string> = {
  NEW_URL: 'New URL',
  REMOVED_URL: 'Removed URL',
  STATUS_CHANGED: 'Status Changed',
  REDIRECT_CHAIN_CHANGED: 'Redirect Changed',
  TITLE_CHANGED: 'Title Changed',
  META_DESCRIPTION_CHANGED: 'Meta Description Changed',
  CANONICAL_CHANGED: 'Canonical Changed',
  ROBOTS_CHANGED: 'Robots Changed',
  H1_COUNT_CHANGED: 'H1 Count Changed',
  WORDCOUNT_CHANGED: 'Word Count Changed',
  HTML_HASH_CHANGED: 'Content Changed',
  TEMPLATE_CHANGED: 'Template Changed',
  ISSUE_COUNT_CHANGED: 'Issue Count Changed',
};

export const DIFF_TYPE_ICONS: Record<DiffType, string> = {
  NEW_URL: '➕',
  REMOVED_URL: '➖',
  STATUS_CHANGED: '🔢',
  REDIRECT_CHAIN_CHANGED: '↪️',
  TITLE_CHANGED: '📝',
  META_DESCRIPTION_CHANGED: '��',
  CANONICAL_CHANGED: '🔗',
  ROBOTS_CHANGED: '🤖',
  H1_COUNT_CHANGED: '🔤',
  WORDCOUNT_CHANGED: '📊',
  HTML_HASH_CHANGED: '🔄',
  TEMPLATE_CHANGED: '🧩',
  ISSUE_COUNT_CHANGED: '⚠️',
};

export const SEVERITY_COLORS: Record<DiffSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

export const DIRECTION_COLORS: Record<DiffDirection, string> = {
  REGRESSION: 'bg-red-100 text-red-700',
  IMPROVEMENT: 'bg-green-100 text-green-700',
  NEUTRAL: 'bg-gray-100 text-gray-700',
};

export const DIRECTION_ICONS: Record<DiffDirection, string> = {
  REGRESSION: '📉',
  IMPROVEMENT: '📈',
  NEUTRAL: '➡️',
};

/**
 * Format before/after value for display
 */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value || '(empty)';
  if (Array.isArray(value)) return value.length > 0 ? `[${value.length} items]` : '[]';
  return JSON.stringify(value);
}

/**
 * Get quick preview fields based on diff type
 */
export function getQuickPreviewFields(type: DiffType): string[] {
  switch (type) {
    case 'STATUS_CHANGED':
      return ['statusCode'];
    case 'TITLE_CHANGED':
      return ['title'];
    case 'META_DESCRIPTION_CHANGED':
      return ['metaDescription'];
    case 'CANONICAL_CHANGED':
      return ['canonical'];
    case 'ROBOTS_CHANGED':
      return ['robotsContent'];
    case 'H1_COUNT_CHANGED':
      return ['h1Count'];
    case 'WORDCOUNT_CHANGED':
      return ['wordCount'];
    case 'REDIRECT_CHAIN_CHANGED':
      return ['redirectChain'];
    case 'ISSUE_COUNT_CHANGED':
      return ['issueCountTotal'];
    case 'TEMPLATE_CHANGED':
      return ['templateId'];
    default:
      return [];
  }
}
