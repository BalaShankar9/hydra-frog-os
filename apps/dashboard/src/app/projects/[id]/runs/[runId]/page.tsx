'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { apiFetch } from '@/lib/api';

interface CrawlRun {
  id: string;
  projectId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  pagesFound: number;
  pagesCrawled: number;
  issuesFound: number;
  createdAt: string;
}

interface Page {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  crawledAt: string | null;
}

interface Issue {
  id: string;
  ruleId: string;
  severity: string;
  message: string;
  pageId: string | null;
}

interface IssueSummary {
  ruleId: string;
  severity: string;
  count: number;
}

type TabType = 'overview' | 'pages' | 'issues';

function CrawlRunDetailContent() {
  const params = useParams();
  const projectId = params.id as string;
  const runId = params.runId as string;

  const [run, setRun] = useState<CrawlRun | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueSummary, setIssueSummary] = useState<IssueSummary[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const data = await apiFetch<CrawlRun>(`/crawl-runs/${runId}`);
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load crawl run');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRun();
  }, [runId]);

  useEffect(() => {
    if (!run) return;
    const fetchData = async () => {
      try {
        const [pagesData, issuesData, summaryData] = await Promise.all([
          apiFetch<Page[]>(`/crawl-runs/${runId}/pages`),
          apiFetch<Issue[]>(`/crawl-runs/${runId}/issues`),
          apiFetch<IssueSummary[]>(`/crawl-runs/${runId}/issues/summary`),
        ]);
        setPages(pagesData);
        setIssues(issuesData);
        setIssueSummary(summaryData);
      } catch (err) {
        console.error('Failed to load run data:', err);
      }
    };
    fetchData();
  }, [run, runId]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${projectId}`} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Project
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    );
  }
  if (!run) return null;

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  const severityColors: Record<string, string> = {
    ERROR: 'bg-red-100 text-red-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    INFO: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Project
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Crawl Run</h1>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[run.status] || 'bg-gray-100'}`}>
            {run.status}
          </span>
        </div>
        <p className="text-gray-500 mt-1">
          {run.startedAt ? `Started ${new Date(run.startedAt).toLocaleString()}` : 'Pending...'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pages Found" value={run.pagesFound} icon="📄" />
        <StatCard label="Pages Crawled" value={run.pagesCrawled} icon="✅" />
        <StatCard label="Issues Found" value={run.issuesFound} icon="⚠️" />
        <StatCard
          label="Duration"
          value={run.startedAt && run.finishedAt
            ? `${Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
            : run.status === 'RUNNING' ? 'Running...' : '-'}
          icon="⏱️"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['overview', 'pages', 'issues'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'pages' && ` (${pages.length})`}
                {tab === 'issues' && ` (${issues.length})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Issue Summary</h3>
                {issueSummary.length === 0 ? (
                  <p className="text-gray-500 text-sm">No issues found 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {issueSummary.map((item) => (
                      <div key={item.ruleId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[item.severity] || 'bg-gray-100'}`}>
                            {item.severity}
                          </span>
                          <span className="text-sm text-gray-900">{item.ruleId.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="space-y-2">
              {pages.length === 0 ? (
                <p className="text-gray-500 text-sm">No pages crawled yet.</p>
              ) : (
                pages.map((page) => (
                  <div key={page.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{page.title || '(No title)'}</div>
                      <div className="text-xs text-gray-500 truncate">{page.url}</div>
                    </div>
                    <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${
                      page.statusCode && page.statusCode >= 200 && page.statusCode < 300
                        ? 'bg-green-100 text-green-800'
                        : page.statusCode && page.statusCode >= 400
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {page.statusCode || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-2">
              {issues.length === 0 ? (
                <p className="text-gray-500 text-sm">No issues found 🎉</p>
              ) : (
                issues.map((issue) => (
                  <div key={issue.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[issue.severity] || 'bg-gray-100'}`}>
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-500">{issue.ruleId}</span>
                    </div>
                    <div className="text-sm text-gray-900">{issue.message}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

export default function CrawlRunDetailPage() {
  return (
    <Protected>
      <AppShell>
        <CrawlRunDetailContent />
      </AppShell>
    </Protected>
  );
}
