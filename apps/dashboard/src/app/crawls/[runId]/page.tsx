'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { DataTable, Column, FilterSelect, FilterToggle, StatusBadge, SeverityBadge } from '@/components/DataTable';
import { useToast } from '@/components/Toast';
import { apiFetch, apiDownload } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface CrawlRun {
  id: string;
  projectId: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED';
  startedAt: string | null;
  finishedAt: string | null;
  totalsJson: {
    pagesCrawled?: number;
    issueCountTotal?: number;
    brokenInternalLinksCount?: number;
  };
  createdAt: string;
}

interface PageItem {
  pageId: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number | null;
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
}

interface IssueItem {
  issueId: string;
  pageId: string | null;
  url: string | null;
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
}

interface RedirectItem {
  pageId: string;
  url: string;
  statusCode: number;
  redirectChainJson: Array<{ url: string; statusCode: number }> | null;
}

interface BrokenLinkItem {
  linkId: string;
  fromPageUrl: string | null;
  toUrl: string;
  statusCode: number | null;
}

interface IssuesSummary {
  byType: Array<{ type: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  total: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

type TabType = 'pages' | 'issues' | 'redirects' | 'broken-links';

// ============================================
// MAIN COMPONENT
// ============================================

function CrawlRunDetailContent() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<CrawlRun | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch run details
  useEffect(() => {
    const fetchRun = async () => {
      try {
        const data = await apiFetch<CrawlRun>(`/crawls/${runId}`);
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load crawl run');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRun();
  }, [runId]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !run) {
    return (
      <div className="space-y-4">
        <Link href="/projects" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Projects
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error || 'Run not found'}</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    QUEUED: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    DONE: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELED: 'bg-gray-100 text-gray-800',
  };

  const totals = run.totalsJson || {};
  const duration = run.startedAt && run.finishedAt
    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/projects/${run.projectId}`} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Project
        </Link>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Crawl Run</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[run.status]}`}>
              {run.status === 'RUNNING' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              {run.status}
            </span>
          </div>
          {run.status === 'DONE' && <ExportDropdown runId={runId} />}
        </div>
        <p className="text-gray-500 text-sm">
          {run.startedAt ? `Started ${new Date(run.startedAt).toLocaleString()}` : 'Pending...'}
          {run.finishedAt && ` • Finished ${new Date(run.finishedAt).toLocaleString()}`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pages Crawled" value={totals.pagesCrawled ?? 0} icon="📄" color="blue" />
        <StatCard label="Issues Found" value={totals.issueCountTotal ?? 0} icon="⚠️" color="yellow" />
        <StatCard label="Broken Links" value={totals.brokenInternalLinksCount ?? 0} icon="🔗" color="red" />
        <StatCard 
          label="Duration" 
          value={run.status === 'RUNNING' ? 'In progress...' : duration !== null ? formatDuration(duration) : '-'} 
          icon="⏱️" 
          color="gray" 
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'pages' as const, label: 'Pages', icon: '📄' },
            { id: 'issues' as const, label: 'Issues', icon: '⚠️' },
            { id: 'redirects' as const, label: 'Redirects', icon: '↪️' },
            { id: 'broken-links' as const, label: 'Broken Links', icon: '🔗' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'pages' && <PagesTab runId={runId} />}
        {activeTab === 'issues' && <IssuesTab runId={runId} />}
        {activeTab === 'redirects' && <RedirectsTab runId={runId} />}
        {activeTab === 'broken-links' && <BrokenLinksTab runId={runId} />}
      </div>
    </div>
  );
}

// ============================================
// PAGES TAB
// ============================================

function PagesTab({ runId }: { runId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [hasIssuesFilter, setHasIssuesFilter] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (hasIssuesFilter) params.set('hasIssues', 'true');
      
      const response = await apiFetch<PaginatedResponse<PageItem>>(`/crawls/${runId}/pages?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize, search, statusFilter, hasIssuesFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, hasIssuesFilter]);

  const columns: Column<PageItem>[] = [
    {
      key: 'statusCode',
      header: 'Status',
      width: '80px',
      render: (item) => <StatusBadge code={item.statusCode} />,
    },
    {
      key: 'url',
      header: 'URL',
      render: (item) => (
        <div className="max-w-md">
          <div className="text-sm font-medium text-gray-900 truncate">{item.title || '(No title)'}</div>
          <div className="text-xs text-gray-500 truncate">{item.url}</div>
        </div>
      ),
    },
    {
      key: 'wordCount',
      header: 'Words',
      width: '80px',
      render: (item) => <span className="text-gray-600">{item.wordCount ?? '-'}</span>,
    },
    {
      key: 'h1Count',
      header: 'H1s',
      width: '60px',
      render: (item) => (
        <span className={item.h1Count === 0 ? 'text-orange-600' : item.h1Count && item.h1Count > 1 ? 'text-yellow-600' : 'text-gray-600'}>
          {item.h1Count ?? '-'}
        </span>
      ),
    },
    {
      key: 'canonical',
      header: 'Canonical',
      width: '100px',
      render: (item) => (
        <span className={`text-xs ${item.canonical ? 'text-green-600' : 'text-gray-400'}`}>
          {item.canonical ? '✓ Set' : 'Missing'}
        </span>
      ),
    },
  ];

  const statusOptions = [
    { value: '200', label: '200 OK' },
    { value: '301', label: '301 Redirect' },
    { value: '302', label: '302 Redirect' },
    { value: '404', label: '404 Not Found' },
    { value: '500', label: '500 Error' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search URL or title..."
      onRowClick={(item) => router.push(`/pages/${item.pageId}?runId=${runId}`)}
      rowKey={(item) => item.pageId}
      emptyMessage="No pages found"
      emptyIcon="📄"
      filters={
        <>
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="All Status Codes"
          />
          <FilterToggle
            label="Has Issues"
            checked={hasIssuesFilter}
            onChange={setHasIssuesFilter}
          />
        </>
      }
    />
  );
}

// ============================================
// ISSUES TAB
// ============================================

function IssuesTab({ runId }: { runId: string }) {
  const [data, setData] = useState<IssueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<IssuesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Fetch summary
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await apiFetch<IssuesSummary>(`/crawls/${runId}/issues/summary`);
        setSummary(response);
      } catch (err) {
        console.error('Failed to fetch issues summary:', err);
      }
    };
    fetchSummary();
  }, [runId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (typeFilter) params.set('type', typeFilter);
      if (severityFilter) params.set('severity', severityFilter);
      
      const response = await apiFetch<PaginatedResponse<IssueItem>>(`/crawls/${runId}/issues?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize, typeFilter, severityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [typeFilter, severityFilter]);

  const columns: Column<IssueItem>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: '100px',
      render: (item) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: 'type',
      header: 'Type',
      width: '180px',
      render: (item) => <span className="text-xs font-mono text-gray-600">{item.type}</span>,
    },
    {
      key: 'title',
      header: 'Issue',
      render: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{item.title}</div>
          <div className="text-xs text-gray-500 truncate max-w-lg">{item.description}</div>
        </div>
      ),
    },
    {
      key: 'url',
      header: 'Page',
      render: (item) => (
        <div className="text-xs text-gray-500 truncate max-w-xs" title={item.url || undefined}>
          {item.url || 'Global'}
        </div>
      ),
    },
  ];

  const severityOptions = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ];

  const typeOptions = summary?.byType.map((t) => ({ value: t.type, label: t.type.replace(/_/g, ' ') })) || [];

  const severityColors: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-500">Total Issues</div>
          </div>
          {summary.bySeverity.map((s) => (
            <div key={s.severity} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${severityColors[s.severity]}`} />
                <div className="text-2xl font-bold text-gray-900">{s.count}</div>
              </div>
              <div className="text-sm text-gray-500">{s.severity}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top Issue Types */}
      {summary && summary.byType.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top Issue Types</h3>
          <div className="flex flex-wrap gap-2">
            {summary.byType.slice(0, 10).map((t) => (
              <button
                key={t.type}
                onClick={() => setTypeFilter(t.type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === t.type
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.type.replace(/_/g, ' ')}
                <span className="text-gray-500">({t.count})</span>
              </button>
            ))}
            {typeFilter && (
              <button
                onClick={() => setTypeFilter('')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
              >
                Clear Filter ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Issues Table */}
      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        rowKey={(item) => item.issueId}
        emptyMessage="No issues found 🎉"
        emptyIcon="✅"
        filters={
          <>
            <FilterSelect
              value={severityFilter}
              onChange={setSeverityFilter}
              options={severityOptions}
              placeholder="All Severities"
            />
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              placeholder="All Types"
            />
          </>
        }
      />
    </div>
  );
}

// ============================================
// REDIRECTS TAB
// ============================================

function RedirectsTab({ runId }: { runId: string }) {
  const [data, setData] = useState<RedirectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      
      const response = await apiFetch<PaginatedResponse<RedirectItem>>(`/crawls/${runId}/redirects?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch redirects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getFinalUrl = (chain: RedirectItem['redirectChainJson']) => {
    if (!chain || !Array.isArray(chain) || chain.length === 0) return null;
    return chain[chain.length - 1]?.url;
  };

  const columns: Column<RedirectItem>[] = [
    {
      key: 'statusCode',
      header: 'Status',
      width: '80px',
      render: (item) => <StatusBadge code={item.statusCode} />,
    },
    {
      key: 'url',
      header: 'Original URL',
      render: (item) => (
        <div className="text-sm text-gray-900 truncate max-w-md" title={item.url}>
          {item.url}
        </div>
      ),
    },
    {
      key: 'finalUrl',
      header: 'Final URL',
      render: (item) => {
        const finalUrl = getFinalUrl(item.redirectChainJson);
        return (
          <div className="text-sm text-gray-600 truncate max-w-md" title={finalUrl || undefined}>
            {finalUrl || '-'}
          </div>
        );
      },
    },
    {
      key: 'chainLength',
      header: 'Chain',
      width: '80px',
      render: (item) => {
        const length = Array.isArray(item.redirectChainJson) ? item.redirectChainJson.length : 0;
        return (
          <span className={`text-sm ${length > 2 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
            {length} hop{length !== 1 ? 's' : ''}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      isLoading={isLoading}
      rowKey={(item) => item.pageId}
      emptyMessage="No redirects found"
      emptyIcon="↪️"
    />
  );
}

// ============================================
// BROKEN LINKS TAB
// ============================================

function BrokenLinksTab({ runId }: { runId: string }) {
  const [data, setData] = useState<BrokenLinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      
      const response = await apiFetch<PaginatedResponse<BrokenLinkItem>>(`/crawls/${runId}/broken-links?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch broken links:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<BrokenLinkItem>[] = [
    {
      key: 'statusCode',
      header: 'Status',
      width: '80px',
      render: (item) => <StatusBadge code={item.statusCode} />,
    },
    {
      key: 'fromPageUrl',
      header: 'Found On',
      render: (item) => (
        <div className="text-sm text-gray-900 truncate max-w-xs" title={item.fromPageUrl || undefined}>
          {item.fromPageUrl || 'Unknown'}
        </div>
      ),
    },
    {
      key: 'toUrl',
      header: 'Broken URL',
      render: (item) => (
        <div className="text-sm text-red-600 truncate max-w-md" title={item.toUrl}>
          {item.toUrl}
        </div>
      ),
    },
    {
      key: 'badge',
      header: '',
      width: '80px',
      render: () => (
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Broken
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      isLoading={isLoading}
      rowKey={(item) => item.linkId}
      emptyMessage="No broken links found 🎉"
      emptyIcon="✅"
    />
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'yellow' | 'red' | 'gray' | 'green';
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const bgColors = {
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${bgColors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="h-10 bg-gray-200 rounded animate-pulse" />
      <div className="bg-white rounded-lg border border-gray-200 h-96 animate-pulse" />
    </div>
  );
}

// ============================================
// EXPORT DROPDOWN
// ============================================

function ExportDropdown({ runId }: { runId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const toast = useToast();

  const exports = [
    { id: 'pages', label: 'Export Pages', icon: '📄', endpoint: `/crawls/${runId}/export/pages.csv`, filename: `pages-${runId}.csv` },
    { id: 'issues', label: 'Export Issues', icon: '⚠️', endpoint: `/crawls/${runId}/export/issues.csv`, filename: `issues-${runId}.csv` },
    { id: 'redirects', label: 'Export Redirects', icon: '↪️', endpoint: `/crawls/${runId}/export/redirects.csv`, filename: `redirects-${runId}.csv` },
    { id: 'broken-links', label: 'Export Broken Links', icon: '🔗', endpoint: `/crawls/${runId}/export/broken-links.csv`, filename: `broken-links-${runId}.csv` },
  ];

  const handleExport = async (exp: typeof exports[0]) => {
    setIsExporting(exp.id);
    setIsOpen(false);
    try {
      await apiDownload(exp.endpoint, exp.filename);
      toast.success(`${exp.label.replace('Export ', '')} exported successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <DownloadIcon className="w-4 h-4" />
        Export
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {exports.map((exp) => (
              <button
                key={exp.id}
                onClick={() => handleExport(exp)}
                disabled={isExporting !== null}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{exp.icon}</span>
                <span className="flex-1 text-left">{exp.label}</span>
                {isExporting === exp.id && (
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// ICONS
// ============================================

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function CrawlRunDetailPage() {
  return (
    <Protected>
      <AppShell>
        <CrawlRunDetailContent />
      </AppShell>
    </Protected>
  );
}
