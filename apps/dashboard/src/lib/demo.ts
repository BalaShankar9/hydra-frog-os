/**
 * Demo/Guest mode — lets visitors explore the dashboard without an account.
 * Uses a special "demo" token that the Protected component recognizes.
 * API calls in demo mode return mock data from this file.
 */

const DEMO_KEY = 'hydra_demo';

export function enterDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_KEY, 'true');
}

export function exitDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_KEY);
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_KEY) === 'true';
}

// ============================================
// MOCK DATA — realistic SEO crawl results
// ============================================

export const DEMO_USER = {
  id: 'demo-user',
  email: 'visitor@hydrafrog.io',
  createdAt: new Date().toISOString(),
  orgMembers: [
    {
      role: 'ADMIN',
      org: { id: 'demo-org', name: 'Demo Organization' },
    },
  ],
};

export const DEMO_ORGS = [
  { id: 'demo-org', name: 'Demo Organization', createdAt: new Date().toISOString() },
];

export const DEMO_PROJECTS = [
  {
    id: 'demo-project-1',
    orgId: 'demo-org',
    name: 'example.com',
    domain: 'example.com',
    startUrl: 'https://example.com',
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'demo-project-2',
    orgId: 'demo-org',
    name: 'blog.example.com',
    domain: 'blog.example.com',
    startUrl: 'https://blog.example.com',
    createdAt: '2026-03-20T14:30:00Z',
  },
];

export const DEMO_CRAWL_RUNS = [
  {
    id: 'demo-run-1',
    projectId: 'demo-project-1',
    status: 'COMPLETED',
    totalPages: 847,
    totalIssues: 23,
    startedAt: '2026-03-28T09:00:00Z',
    finishedAt: '2026-03-28T09:04:32Z',
    createdAt: '2026-03-28T09:00:00Z',
  },
  {
    id: 'demo-run-2',
    projectId: 'demo-project-2',
    status: 'COMPLETED',
    totalPages: 312,
    totalIssues: 8,
    startedAt: '2026-03-29T14:00:00Z',
    finishedAt: '2026-03-29T14:01:45Z',
    createdAt: '2026-03-29T14:00:00Z',
  },
];

export const DEMO_STATS = {
  totalProjects: 2,
  totalCrawls: 2,
  totalPages: 1159,
  totalIssues: 31,
};
