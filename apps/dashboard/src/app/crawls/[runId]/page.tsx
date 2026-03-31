'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { DataTable, Column, FilterSelect, FilterToggle, StatusBadge, SeverityBadge } from '@/components/DataTable';
import { ChangesTab } from '@/components/DiffView';
import { useToast } from '@/components/Toast';
import { apiFetch, apiDownload } from '@/lib/api';
import { DiffResponse, fetchDiffForCrawlRun } from '@/lib/diff';

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

interface TemplateItem {
  templateId: string;
  name: string;
  pageCount: number;
  sampleUrl: string | null;
  issueCountTotal: number;
  severityCounts: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
  topIssueTypes: Array<{ type: string; count: number }>;
}

type TabType = 'pages' | 'issues' | 'redirects' | 'broken-links' | 'templates' | 'changes' | 'rendered' | 'performance' | 'fixes';

// Render types
interface RenderSummary {
  skipped: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  donePages: RenderDonePage[];
}

// Performance types
interface PerfSummary {
  queued: number;
  running: number;
  done: number;
  failed: number;
  avgScore: number | null;
  worstTemplates: Array<{
    templateId: string;
    name: string | null;
    avgScore: number;
    lcpAvg: number | null;
  }>;
  regressionCount: number;
  device: string;
  mode: string;
}

interface PerfAuditItem {
  id: string;
  url: string;
  device: string;
  status: string;
  score: number | null;
  templateId: string | null;
  templateName: string | null;
  finishedAt: string | null;
  error: string | null;
  metrics: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    tbt: number | null;
    totalTransferSize: number | null;
  };
}

interface PerfRegressionItem {
  id: string;
  url: string;
  device: string;
  regressionType: string;
  severity: string;
  templateId: string | null;
  templateName: string | null;
  createdAt: string;
  delta: {
    type: string;
    before: number | null;
    after: number | null;
    change: number | null;
  };
}

interface RenderDonePage {
  pageId: string;
  url: string;
  renderedTitle: string | null;
  renderScreenshotPath: string | null;
}

// Fixes types
interface FixesSummary {
  total: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  criticalCount: number;
  regressionCount: number;
  topFixTypes: Array<{ fixType: string; count: number }>;
  byTemplate: Array<{ templateId: string | null; templateName: string | null; count: number }>;
}

interface FixSuggestionItem {
  id: string;
  fixType: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priorityScore: number | null;
  impactScore: number | null;
  effortScore: number | null;
  title: string;
  summary: string;
  affectedPagesCount: number;
  templateId: string | null;
  templateName: string | null;
  createdAt: string;
  updatedAt: string;
}



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

  // Diff state
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [diffFetched, setDiffFetched] = useState(false);

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

  // Fetch diff when tab changes to 'changes'
  useEffect(() => {
    if (activeTab === 'changes' && !diffFetched && run?.status === 'DONE') {
      setIsDiffLoading(true);
      fetchDiffForCrawlRun(runId)
        .then((data) => {
          setDiff(data);
          setDiffFetched(true);
        })
        .catch((err) => {
          console.error('Failed to fetch diff:', err);
          setDiffFetched(true);
        })
        .finally(() => {
          setIsDiffLoading(false);
        });
    }
  }, [activeTab, runId, diffFetched, run?.status]);

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

  const tabs = [
    { id: 'pages' as const, label: 'Pages', icon: '📄' },
    { id: 'issues' as const, label: 'Issues', icon: '⚠️' },
    { id: 'fixes' as const, label: 'Fixes', icon: '🔧' },
    { id: 'templates' as const, label: 'Templates', icon: '🧩' },
    { id: 'changes' as const, label: 'Changes', icon: '🔄' },
    { id: 'rendered' as const, label: 'Rendered', icon: '🖼️' },
    { id: 'performance' as const, label: 'Performance', icon: '⚡' },
    { id: 'redirects' as const, label: 'Redirects', icon: '↪️' },
    { id: 'broken-links' as const, label: 'Broken Links', icon: '🔗' },
  ];

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
          {tabs.map((tab) => (
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
        {activeTab === 'templates' && <TemplatesTab runId={runId} />}
        {activeTab === 'fixes' && <FixesTab runId={runId} />}
        {activeTab === 'changes' && <ChangesTab runId={runId} diff={diff} isLoading={isDiffLoading} />}
        {activeTab === 'rendered' && <RenderedTab runId={runId} />}
        {activeTab === 'performance' && <PerformanceTab runId={runId} />}
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
// RENDERED TAB
// ============================================

function RenderedTab({ runId }: { runId: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<RenderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await apiFetch<RenderSummary>(`/crawls/${runId}/render-summary`);
      setSummary(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load render summary');
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh while rendering is in progress
  useEffect(() => {
    if (!summary) return;
    if (summary.queued === 0 && summary.running === 0) return;

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [summary, fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  const statusColors: Record<string, string> = {
    skipped: 'bg-gray-100 text-gray-700',
    queued: 'bg-yellow-100 text-yellow-700',
    running: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  const total = summary.skipped + summary.queued + summary.running + summary.done + summary.failed;
  const inProgress = summary.queued + summary.running > 0;

  return (
    <div className="space-y-6">
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`rounded-lg border p-4 ${statusColors.skipped}`}>
          <div className="text-2xl font-bold">{summary.skipped}</div>
          <div className="text-sm">Skipped</div>
        </div>
        <div className={`rounded-lg border p-4 ${statusColors.queued}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{summary.queued}</span>
            {summary.queued > 0 && <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
          </div>
          <div className="text-sm">Queued</div>
        </div>
        <div className={`rounded-lg border p-4 ${statusColors.running}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{summary.running}</span>
            {summary.running > 0 && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
          </div>
          <div className="text-sm">Running</div>
        </div>
        <div className={`rounded-lg border p-4 ${statusColors.done}`}>
          <div className="text-2xl font-bold">{summary.done}</div>
          <div className="text-sm">Done</div>
        </div>
        <div className={`rounded-lg border p-4 ${statusColors.failed}`}>
          <div className="text-2xl font-bold">{summary.failed}</div>
          <div className="text-sm">Failed</div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Render Progress</span>
            {inProgress && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Auto-refreshing...
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(summary.done / total) * 100}%` }}
              />
              <div
                className="bg-blue-500 transition-all duration-300"
                style={{ width: `${(summary.running / total) * 100}%` }}
              />
              <div
                className="bg-yellow-500 transition-all duration-300"
                style={{ width: `${(summary.queued / total) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(summary.failed / total) * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {summary.done} of {total - summary.skipped} pages rendered
          </div>
        </div>
      )}

      {/* Rendered Pages Table */}
      {summary.donePages.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Rendered Pages ({summary.donePages.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {summary.donePages.map((page) => (
              <div
                key={page.pageId}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/pages/${page.pageId}?runId=${runId}`)}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      DONE
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {page.renderedTitle || '(No title)'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{page.url}</div>
                </div>
                {page.renderScreenshotPath && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPageId(page.pageId);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    📷 Screenshot
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {summary.donePages.length === 0 && summary.queued === 0 && summary.running === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🖼️</div>
          <div className="text-gray-600 mb-1">No pages have been rendered yet</div>
          <div className="text-sm text-gray-400">
            Pages will be rendered based on the project's render mode setting
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedPageId && (
        <ScreenshotModal
          pageId={selectedPageId}
          onClose={() => setSelectedPageId(null)}
        />
      )}
    </div>
  );
}

// ============================================
// SCREENSHOT MODAL
// ============================================

function ScreenshotModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const screenshotUrl = `${apiBase}/pages/${pageId}/screenshot`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Screenshot Preview</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}
          <img
            src={screenshotUrl}
            alt="Page screenshot"
            className={`w-full rounded border border-gray-200 ${isLoading ? 'hidden' : ''}`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load screenshot');
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ============================================
// PERFORMANCE TAB
// ============================================

function PerformanceTab({ runId }: { runId: string }) {
  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [audits, setAudits] = useState<PerfAuditItem[]>([]);
  const [regressions, setRegressions] = useState<PerfRegressionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'audits' | 'regressions'>('audits');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, auditsRes, regressionsRes] = await Promise.all([
        apiFetch<PerfSummary>(`/crawls/${runId}/perf/summary`),
        apiFetch<{ items: PerfAuditItem[] }>(`/crawls/${runId}/perf/audits?pageSize=50`),
        apiFetch<{ items: PerfRegressionItem[] }>(`/crawls/${runId}/perf/regressions?pageSize=50`),
      ]);
      setSummary(summaryRes);
      setAudits(auditsRes.items);
      setRegressions(regressionsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh while audits are in progress
  useEffect(() => {
    if (!summary) return;
    if (summary.queued === 0 && summary.running === 0) return;

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [summary, fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  const inProgress = summary.queued + summary.running > 0;
  const total = summary.queued + summary.running + summary.done + summary.failed;

  const formatBytes = (bytes: number | null) => {
    if (bytes === null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatMs = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100';
    if (score >= 90) return 'bg-green-100';
    if (score >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const severityColors: Record<string, string> = {
    LOW: 'bg-blue-100 text-blue-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold">{summary.queued}</div>
          <div className="text-sm text-gray-500">Queued</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{summary.running}</span>
            {summary.running > 0 && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
          </div>
          <div className="text-sm text-gray-500">Running</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{summary.done}</div>
          <div className="text-sm text-gray-500">Done</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
        <div className={`rounded-lg border p-4 ${getScoreBg(summary.avgScore)}`}>
          <div className={`text-2xl font-bold ${getScoreColor(summary.avgScore)}`}>
            {summary.avgScore ?? '-'}
          </div>
          <div className="text-sm text-gray-500">Avg Score</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">{summary.regressionCount}</div>
          <div className="text-sm text-gray-500">Regressions</div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Performance Audit Progress ({summary.device} • {summary.mode})
            </span>
            {inProgress && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Auto-refreshing...
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(summary.done / total) * 100}%` }}
              />
              <div
                className="bg-blue-500 transition-all duration-300"
                style={{ width: `${(summary.running / total) * 100}%` }}
              />
              <div
                className="bg-yellow-500 transition-all duration-300"
                style={{ width: `${(summary.queued / total) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(summary.failed / total) * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {summary.done} of {total} audits complete
          </div>
        </div>
      )}

      {/* Worst Templates */}
      {summary.worstTemplates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Worst Performing Templates</h3>
          <div className="space-y-2">
            {summary.worstTemplates.map((t) => (
              <div key={t.templateId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{t.name || t.templateId}</span>
                <div className="flex items-center gap-4">
                  <span className={`font-medium ${getScoreColor(t.avgScore)}`}>
                    Score: {t.avgScore}
                  </span>
                  <span className="text-gray-500">
                    LCP: {formatMs(t.lcpAvg)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveSection('audits')}
            className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === 'audits'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Audits ({audits.length})
          </button>
          <button
            onClick={() => setActiveSection('regressions')}
            className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === 'regressions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Regressions ({regressions.length})
          </button>
        </nav>
      </div>

      {/* Audits Table */}
      {activeSection === 'audits' && audits.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LCP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CLS</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">INP/TBT</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audits.map((audit) => (
                <tr key={audit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate max-w-xs" title={audit.url}>
                      {new URL(audit.url).pathname}
                    </div>
                    <div className="text-xs text-gray-500">{audit.status}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {audit.templateName || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded text-sm font-medium ${getScoreBg(audit.score)} ${getScoreColor(audit.score)}`}>
                      {audit.score ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatMs(audit.metrics.lcp)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {audit.metrics.cls?.toFixed(3) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatMs(audit.metrics.inp ?? audit.metrics.tbt)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatBytes(audit.metrics.totalTransferSize)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {audit.status === 'DONE' && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/perf-audits/${audit.id}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Report →
                      </a>
                    )}
                    {audit.error && (
                      <span className="text-red-500 text-xs" title={audit.error}>⚠️</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Regressions Table */}
      {activeSection === 'regressions' && regressions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Before</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">After</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {regressions.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate max-w-xs" title={r.url}>
                      {new URL(r.url).pathname}
                    </div>
                    {r.templateName && (
                      <div className="text-xs text-gray-500">{r.templateName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.regressionType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors[r.severity] || 'bg-gray-100 text-gray-800'}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {r.delta.before !== null ? (
                      r.regressionType.includes('SCORE') ? r.delta.before :
                      r.regressionType.includes('CLS') ? r.delta.before?.toFixed(3) :
                      r.regressionType.includes('TRANSFER') ? formatBytes(r.delta.before) :
                      formatMs(r.delta.before)
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {r.delta.after !== null ? (
                      r.regressionType.includes('SCORE') ? r.delta.after :
                      r.regressionType.includes('CLS') ? r.delta.after?.toFixed(3) :
                      r.regressionType.includes('TRANSFER') ? formatBytes(r.delta.after) :
                      formatMs(r.delta.after)
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                    {r.delta.change !== null ? (
                      r.regressionType.includes('SCORE') ? `-${Math.abs(r.delta.change)}` :
                      r.regressionType.includes('CLS') ? `+${r.delta.change?.toFixed(3)}` :
                      r.regressionType.includes('TRANSFER') ? `+${formatBytes(r.delta.change)}` :
                      `+${formatMs(r.delta.change)}`
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty States */}
      {activeSection === 'audits' && audits.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-gray-600 mb-1">No performance audits yet</div>
          <div className="text-sm text-gray-400">
            Enable performance audits in project settings to run Lighthouse audits
          </div>
        </div>
      )}

      {activeSection === 'regressions' && regressions.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-gray-600 mb-1">No performance regressions detected</div>
          <div className="text-sm text-gray-400">
            Regressions are detected by comparing against established baselines
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TEMPLATES TAB
// ============================================

function TemplatesTab({ runId }: { runId: string }) {
  const router = useRouter();
  const [data, setData] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('q', search);
      
      const response = await apiFetch<PaginatedResponse<TemplateItem>>(`/crawls/${runId}/templates?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  const columns: Column<TemplateItem>[] = [
    {
      key: 'name',
      header: 'Template',
      render: (item) => (
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <span className="text-base">🗂️</span>
            <span className="text-sm font-medium text-gray-900">{item.name}</span>
          </div>
          {item.sampleUrl && (
            <div className="text-xs text-gray-500 truncate ml-6" title={item.sampleUrl}>
              {item.sampleUrl}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'pageCount',
      header: 'Pages',
      width: '100px',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 text-sm">📄</span>
          <span className="text-sm font-medium text-gray-900">{item.pageCount}</span>
        </div>
      ),
    },
    {
      key: 'issueCountTotal',
      header: 'Issues',
      width: '100px',
      render: (item) => (
        <span className={`text-sm font-medium ${item.issueCountTotal > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
          {item.issueCountTotal > 0 ? `⚠️ ${item.issueCountTotal}` : '✓ 0'}
        </span>
      ),
    },
    {
      key: 'severityCounts',
      header: 'Severity Breakdown',
      width: '200px',
      render: (item) => {
        const { CRITICAL, HIGH, MEDIUM, LOW } = item.severityCounts;
        if (CRITICAL === 0 && HIGH === 0 && MEDIUM === 0 && LOW === 0) {
          return <span className="text-xs text-gray-400">No issues</span>;
        }
        const severityColors: Record<string, string> = {
          CRITICAL: 'bg-red-100 text-red-800',
          HIGH: 'bg-orange-100 text-orange-800',
          MEDIUM: 'bg-yellow-100 text-yellow-800',
          LOW: 'bg-blue-100 text-blue-800',
        };
        return (
          <div className="flex gap-1.5 flex-wrap">
            {CRITICAL > 0 && (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors.CRITICAL}`}>
                {CRITICAL} Critical
              </span>
            )}
            {HIGH > 0 && (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors.HIGH}`}>
                {HIGH} High
              </span>
            )}
            {MEDIUM > 0 && (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors.MEDIUM}`}>
                {MEDIUM} Medium
              </span>
            )}
            {LOW > 0 && (
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityColors.LOW}`}>
                {LOW} Low
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'topIssueTypes',
      header: 'Top Issues',
      render: (item) => {
        if (!item.topIssueTypes || item.topIssueTypes.length === 0) {
          return <span className="text-xs text-gray-400">—</span>;
        }
        return (
          <div className="flex gap-1.5 flex-wrap">
            {item.topIssueTypes.slice(0, 3).map((issue, idx) => (
              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                {issue.type.replace(/_/g, ' ')} ({issue.count})
              </span>
            ))}
          </div>
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
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search templates..."
      onRowClick={(item) => router.push(`/templates/${item.templateId}`)}
      rowKey={(item) => item.templateId}
      emptyMessage="No templates found"
      emptyIcon="🧩"
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
// FIXES TAB
// ============================================

function FixesTab({ runId }: { runId: string }) {
  const toast = useToast();
  const [summary, setSummary] = useState<FixesSummary | null>(null);
  const [fixes, setFixes] = useState<FixSuggestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Fetch summary
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await apiFetch<FixesSummary>(`/crawls/${runId}/fixes/summary`);
        setSummary(data);
      } catch (err) {
        console.error('Failed to fetch fixes summary:', err);
      }
    };
    fetchSummary();
  }, [runId]);

  // Fetch fixes list
  const fetchFixes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (statusFilter) params.set('status', statusFilter);
      if (templateFilter) params.set('templateId', templateFilter);

      const response = await apiFetch<{ items: FixSuggestionItem[]; total: number }>(
        `/crawls/${runId}/fixes?${params}`
      );
      setFixes(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch fixes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [runId, page, pageSize, statusFilter, templateFilter]);

  useEffect(() => { fetchFixes(); }, [fetchFixes]);
  useEffect(() => { setPage(1); }, [statusFilter, templateFilter]);

  // Update fix status
  const updateStatus = async (fixId: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE') => {
    setUpdatingStatus(fixId);
    try {
      await apiFetch(`/fixes/${fixId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setFixes(prev => prev.map(f => f.id === fixId ? { ...f, status: newStatus } : f));
      // Update summary counts
      if (summary) {
        const oldFix = fixes.find(f => f.id === fixId);
        if (oldFix) {
          const newSummary = { ...summary };
          if (oldFix.status === 'OPEN') newSummary.openCount--;
          if (oldFix.status === 'IN_PROGRESS') newSummary.inProgressCount--;
          if (oldFix.status === 'DONE') newSummary.doneCount--;
          if (newStatus === 'OPEN') newSummary.openCount++;
          if (newStatus === 'IN_PROGRESS') newSummary.inProgressCount++;
          if (newStatus === 'DONE') newSummary.doneCount++;
          setSummary(newSummary);
        }
      }
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Export handlers
  const handleExportCsv = async () => {
    try {
      await apiDownload(`/crawls/${runId}/fixes/export.csv`, `fixes-${runId}.csv`);
      toast.success('Fixes exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleExportFixPack = async () => {
    try {
      await apiDownload(`/crawls/${runId}/fixpack.md`, `fixpack-${runId}.md`);
      toast.success('Fix Pack downloaded');
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 15) return 'text-red-600 font-semibold';
    if (score >= 10) return 'text-orange-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'DONE': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFixType = (type: string) => {
    return type.replace('FIX_', '').replace(/_/g, ' ').toLowerCase()
      .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Fixes</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-600">Open</div>
            <div className="text-2xl font-bold text-red-700">{summary.openCount}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-sm text-yellow-600">In Progress</div>
            <div className="text-2xl font-bold text-yellow-700">{summary.inProgressCount}</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-sm text-green-600">Done</div>
            <div className="text-2xl font-bold text-green-700">{summary.doneCount}</div>
          </div>
          <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
            <div className="text-sm text-purple-600">Regressions</div>
            <div className="text-2xl font-bold text-purple-700">{summary.regressionCount}</div>
          </div>
        </div>
      )}

      {/* Filters and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          {summary && summary.byTemplate.length > 0 && (
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Templates</option>
              {summary.byTemplate.map((t) => (
                <option key={t.templateId ?? 'global'} value={t.templateId ?? ''}>
                  {t.templateName ?? 'Global'} ({t.count})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            📥 Export CSV
          </button>
          <button
            onClick={handleExportFixPack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            📋 Download Fix Pack
          </button>
        </div>
      </div>

      {/* Fixes Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fix</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Template</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Pages</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : fixes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No fix suggestions found
                </td>
              </tr>
            ) : (
              fixes.map((fix) => (
                <tr key={fix.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={getScoreColor(fix.priorityScore)} title={`Impact: ${fix.impactScore ?? '-'} | Effort: ${fix.effortScore ?? '-'}`}>
                      {fix.priorityScore?.toFixed(1) ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{fix.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-md">{fix.summary}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {fix.templateName ?? <span className="text-gray-400">Global</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {fix.affectedPagesCount}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={fix.status}
                      onChange={(e) => updateStatus(fix.id, e.target.value as 'OPEN' | 'IN_PROGRESS' | 'DONE')}
                      disabled={updatingStatus === fix.id}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${getStatusColor(fix.status)}`}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                    {updatingStatus === fix.id && (
                      <span className="ml-2 inline-block w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/fixes/${fix.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} fixes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Top Fix Types */}
      {summary && summary.topFixTypes.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top Fix Types</h3>
          <div className="flex flex-wrap gap-2">
            {summary.topFixTypes.map((t) => (
              <span
                key={t.fixType}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
              >
                {formatFixType(t.fixType)}
                <span className="text-gray-500">({t.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
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
    { id: 'fixes', label: 'Export Fixes', icon: '🔧', endpoint: `/crawls/${runId}/fixes/export.csv`, filename: `fixes-${runId}.csv` },
    { id: 'fixpack', label: 'Download Fix Pack', icon: '📋', endpoint: `/crawls/${runId}/fixpack.md`, filename: `fixpack-${runId}.md` },
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
