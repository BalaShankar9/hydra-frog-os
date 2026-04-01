/**
 * API Client Wrapper - fetch wrapper with auth and error handling
 */

import { getToken, clearToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Custom API Error class with status code and response data
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Build URL with query parameters
 */
export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, API_BASE_URL);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Request options for apiFetch
 */
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Main API fetch wrapper
 * - Automatically includes Authorization header if token exists
 * - Parses JSON responses
 * - Provides helpful error messages
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getToken();

  // Guest mode — return mock data without hitting the API
  if (token === 'guest') {
    return getGuestData<T>(path, options);
  }

  const { body, params, headers: customHeaders, ...restOptions } = options;

  const url = buildUrl(path, params);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  
  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
  };
  
  // Add body if provided
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Try to parse JSON response
    let data: unknown;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorMessage = extractErrorMessage(data, response.status);
      
      // Auto-logout on 401 Unauthorized
      if (response.status === 401) {
        clearToken();
        // Redirect to login if we're in a browser context
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      
      throw new ApiError(errorMessage, response.status, data);
    }
    
    return data as T;
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to the API server', 0);
    }
    
    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      0
    );
  }
}

/**
 * Download a file from the API (handles auth header and blob download)
 * @param path - API endpoint path
 * @param filename - Name for the downloaded file
 */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const url = buildUrl(path);
  const token = getToken();

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Download failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = extractErrorMessage(errorData, response.status);
      } catch {
        // Ignore JSON parse errors
      }

      // Auto-logout on 401
      if (response.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new ApiError(errorMessage, response.status);
    }

    // Get the blob and create download link
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Download failed',
      0
    );
  }
}

/**
 * Extract a user-friendly error message from API response
 */
function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    
    // Handle NestJS validation errors (array of messages)
    if (Array.isArray(obj.message)) {
      return obj.message.join(', ');
    }
    
    // Handle single message
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    
    // Handle error field
    if (typeof obj.error === 'string') {
      return obj.error;
    }
  }
  
  // Default messages based on status code
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Unauthorized - Please log in';
    case 403:
      return 'Forbidden - You do not have permission';
    case 404:
      return 'Resource not found';
    case 500:
      return 'Internal server error';
    default:
      return `Request failed with status ${status}`;
  }
}

// ============================================
// API Endpoint Helpers
// ============================================

/**
 * Auth API endpoints
 */
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: { id: string; email: string; tier: string } }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  signup: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: { id: string; email: string; tier: string } }>('/auth/signup', {
      method: 'POST',
      body: { email, password },
    }),

  guest: () =>
    apiFetch<{ accessToken: string; user: { id: string; email: string; tier: string } }>('/auth/guest', {
      method: 'POST',
    }),

  me: () =>
    apiFetch<{
      id: string;
      email: string;
      tier: string;
      crawlsUsed: number;
      createdAt: string;
      limits: { crawlsAllowed: number; crawlsRemaining: number; pagesPerCrawl: number };
      orgMembers: Array<{ role: string; org: { id: string; name: string } }>;
    }>('/auth/me'),
};

/**
 * Projects API endpoints
 */
export const projectsApi = {
  list: (params?: { orgId?: string }) =>
    apiFetch<Array<{
      id: string;
      orgId: string;
      name: string;
      domain: string;
      startUrl: string;
      createdAt: string;
    }>>('/projects', { params }),
    
  get: (id: string) =>
    apiFetch<{
      id: string;
      orgId: string;
      name: string;
      domain: string;
      startUrl: string;
      settingsJson: Record<string, unknown>;
      createdAt: string;
    }>(`/projects/${id}`),
};

/**
 * Organizations API endpoints
 */
export const orgsApi = {
  list: () =>
    apiFetch<Array<{
      id: string;
      name: string;
      createdAt: string;
    }>>('/orgs'),
    
  create: (name: string) =>
    apiFetch<{ id: string; name: string }>('/orgs', {
      method: 'POST',
      body: { name },
    }),
};

// ============================================
// Guest Mode — mock data for all endpoints
// ============================================

const GUEST_PROJECTS = [
  { id: 'gp-1', orgId: 'g-org', name: 'example.com', domain: 'example.com', startUrl: 'https://example.com', settingsJson: { maxPages: 500 }, createdAt: '2026-03-15T10:00:00Z' },
  { id: 'gp-2', orgId: 'g-org', name: 'blog.example.com', domain: 'blog.example.com', startUrl: 'https://blog.example.com', settingsJson: { maxPages: 500 }, createdAt: '2026-03-20T14:00:00Z' },
];

const GUEST_CRAWL_RUNS = [
  { id: 'gr-1', projectId: 'gp-1', status: 'COMPLETED', totalPages: 847, totalIssues: 23, startedAt: '2026-03-28T09:00:00Z', finishedAt: '2026-03-28T09:04:32Z', createdAt: '2026-03-28T09:00:00Z' },
  { id: 'gr-2', projectId: 'gp-2', status: 'COMPLETED', totalPages: 312, totalIssues: 8, startedAt: '2026-03-29T14:00:00Z', finishedAt: '2026-03-29T14:01:45Z', createdAt: '2026-03-29T14:00:00Z' },
];

const GUEST_ISSUES = [
  { id: 'gi-1', crawlRunId: 'gr-1', type: 'MISSING_TITLE', severity: 'CRITICAL', title: 'Missing title tag', description: 'Page has no <title> element', recommendation: 'Add a descriptive title tag', pageId: 'pg-1', page: { url: 'https://example.com/about' } },
  { id: 'gi-2', crawlRunId: 'gr-1', type: 'DUPLICATE_META', severity: 'HIGH', title: 'Duplicate meta description', description: '3 pages share the same meta description', recommendation: 'Write unique meta descriptions', pageId: 'pg-2', page: { url: 'https://example.com/products' } },
  { id: 'gi-3', crawlRunId: 'gr-1', type: 'BROKEN_LINK', severity: 'HIGH', title: 'Broken internal link', description: 'Link returns 404', recommendation: 'Fix or remove the broken link', pageId: 'pg-3', page: { url: 'https://example.com/old-page' } },
  { id: 'gi-4', crawlRunId: 'gr-1', type: 'MISSING_H1', severity: 'MEDIUM', title: 'Missing H1 tag', description: 'Page has no H1 heading', recommendation: 'Add a single H1 heading', pageId: 'pg-4', page: { url: 'https://example.com/contact' } },
  { id: 'gi-5', crawlRunId: 'gr-1', type: 'THIN_CONTENT', severity: 'MEDIUM', title: 'Thin content', description: 'Page has fewer than 300 words', recommendation: 'Add more substantive content', pageId: 'pg-5', page: { url: 'https://example.com/faq' } },
];

const GUEST_PAGES = [
  { pageId: 'pg-1', url: 'https://example.com/', statusCode: 200, title: 'Example - Home', metaDescription: 'Welcome to Example', h1Count: 1, canonical: 'https://example.com/', robotsMeta: null, wordCount: 1250 },
  { pageId: 'pg-2', url: 'https://example.com/about', statusCode: 200, title: null, metaDescription: null, h1Count: 0, canonical: null, robotsMeta: null, wordCount: 180 },
  { pageId: 'pg-3', url: 'https://example.com/products', statusCode: 200, title: 'Products', metaDescription: 'Our products', h1Count: 1, canonical: 'https://example.com/products', robotsMeta: null, wordCount: 950 },
  { pageId: 'pg-4', url: 'https://example.com/contact', statusCode: 200, title: 'Contact Us', metaDescription: 'Get in touch', h1Count: 0, canonical: null, robotsMeta: null, wordCount: 120 },
  { pageId: 'pg-5', url: 'https://example.com/old-page', statusCode: 404, title: null, metaDescription: null, h1Count: 0, canonical: null, robotsMeta: null, wordCount: 0 },
];

function getGuestData<T>(path: string, _options: ApiFetchOptions): T {
  // Auth
  if (path === '/auth/me') {
    return {
      id: 'guest', email: 'Guest', tier: 'GUEST', crawlsUsed: 0, createdAt: new Date().toISOString(),
      limits: { pagesPerCrawl: 500, maxProjects: 1, aiQueriesPerDay: 5, competitors: false, jsRendering: false, teamMembers: 1, whiteLabel: false },
      orgMembers: [{ role: 'ADMIN', org: { id: 'g-org', name: 'Guest Workspace' } }],
    } as T;
  }

  // Orgs
  if (path === '/orgs') {
    return [{ id: 'g-org', name: 'Guest Workspace', createdAt: new Date().toISOString() }] as T;
  }

  // Projects
  if (path === '/projects') return GUEST_PROJECTS as T;
  if (path.startsWith('/projects/')) return GUEST_PROJECTS[0] as T;

  // Crawl runs
  if (path.includes('/crawl/runs')) {
    const projectId = new URL('http://x' + path).searchParams?.get('projectId') || path.match(/projectId=([^&]*)/)?.[1];
    if (path.includes('runs/')) {
      return GUEST_CRAWL_RUNS[0] as T;
    }
    const runs = projectId ? GUEST_CRAWL_RUNS.filter(r => r.projectId === projectId) : GUEST_CRAWL_RUNS;
    return { items: runs, total: runs.length } as T;
  }

  // Flags
  if (path.includes('/flags')) {
    return { items: [
      { key: 'studio.enabled', enabled: true, scope: 'GLOBAL' },
      { key: 'tools.templatesV2', enabled: true, scope: 'GLOBAL' },
      { key: 'tools.diffInsights', enabled: true, scope: 'GLOBAL' },
      { key: 'tools.performance', enabled: true, scope: 'GLOBAL' },
      { key: 'tools.fixEngine', enabled: true, scope: 'GLOBAL' },
    ] } as T;
  }

  // Issues
  if (path.includes('/issues')) return { items: GUEST_ISSUES, total: GUEST_ISSUES.length } as T;

  // Pages
  if (path.includes('/pages/') && path.includes('/details')) {
    return { ...GUEST_PAGES[0], issues: GUEST_ISSUES.slice(0, 2), outgoingLinks: [], inlinks: [], renderStatus: 'SKIPPED', redirectChainJson: null } as T;
  }
  if (path.includes('/pages')) return { items: GUEST_PAGES, total: GUEST_PAGES.length } as T;

  // Templates
  if (path.includes('/templates/') && path.includes('/pages')) return { items: GUEST_PAGES.slice(0, 3), total: 3 } as T;
  if (path.includes('/templates/') && path.includes('/issues')) return { items: GUEST_ISSUES.slice(0, 2), total: 2 } as T;
  if (path.includes('/templates/')) return { id: 't-1', crawlRunId: 'gr-1', name: 'Product Pages', pageCount: 45, sampleUrl: 'https://example.com/products' } as T;

  // Diffs
  if (path.includes('/diff')) return { id: 'd-1', fromRunId: 'gr-1', toRunId: 'gr-2', summaryJson: { regressions: 2, improvements: 5 }, items: [] } as T;

  // Fixes
  if (path.includes('/fixes/')) return { id: 'f-1', crawlRunId: 'gr-1', projectId: 'gp-1', fixType: 'FIX_MISSING_TITLE', status: 'OPEN', priorityScore: 8.5, impactScore: 9, effortScore: 2, title: 'Add missing title tags', summary: '12 pages are missing title tags', recommendation: '1. Identify all pages without titles\n2. Write unique descriptive titles\n3. Deploy changes', evidenceJson: null, affectedPagesCount: 12, templateName: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [] } as T;
  if (path.includes('/fixes')) return { items: [], total: 0 } as T;

  // AI
  if (path.includes('/ai/query')) return { answer: 'This is a preview of the AI Copilot. Sign up to ask questions about your own crawl data.', model: 'preview', tokensUsed: 0 } as T;
  if (path.includes('/ai/suggestions')) return { answer: 'Sign up to get AI-powered SEO suggestions for your site.', model: 'preview', tokensUsed: 0 } as T;

  // Competitor
  if (path.includes('/competitor')) return { yourDomain: { domain: 'example.com', totalPages: 847, totalIssues: 23, avgWordCount: 650, pagesWithH1: 780, pagesWithCanonical: 600, pagesWithMetaDesc: 720 }, competitor: { domain: 'competitor.com', totalPages: 1200, totalIssues: 15, avgWordCount: 890, pagesWithH1: 1150, pagesWithCanonical: 1100, pagesWithMetaDesc: 1180 }, advantages: [], gaps: [{ metric: 'Total Pages', yours: 847, theirs: 1200, impact: 'negative' }], opportunities: ['Competitor has 353 more pages. Consider expanding content.'] } as T;

  // Health
  if (path === '/health') return { success: true, data: { status: 'healthy', timestamp: new Date().toISOString(), uptime: 3600 } } as T;

  // Default — return empty
  return {} as T;
}
