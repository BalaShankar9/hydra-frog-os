'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { DataTable, Column, FilterSelect, FilterToggle, StatusBadge, SeverityBadge } from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface TemplateDetail {
  id: string;
  crawlRunId: string;
  name: string;
  pageCount: number;
  sampleUrl: string | null;
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

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

type TabType = 'pages' | 'issues';

// ============================================
// MAIN COMPONENT
// ============================================

function TemplateDetailContent() {
  const params = useParams();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch template details
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const data = await apiFetch<TemplateDetail>(`/templates/${templateId}`);
        setTemplate(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplate();
  }, [templateId]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !template) {
    return (
      <div className="space-y-4">
        <Link href="/projects" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Projects
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error || 'Template not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link 
          href={`/crawls/${template.crawlRunId}`} 
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to Crawl Run
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🗂️</span>
              <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-base">📄</span>
                <span className="font-medium text-gray-900">{template.pageCount}</span> pages
              </span>
              {template.sampleUrl && (
                <span className="truncate max-w-md" title={template.sampleUrl}>
                  Sample: {template.sampleUrl}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'pages' as const, label: 'Pages', icon: '📄', count: template.pageCount },
            { id: 'issues' as const, label: 'Issues', icon: '⚠️' },
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
              {tab.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'pages' && <PagesTab templateId={templateId} crawlRunId={template.crawlRunId} />}
        {activeTab === 'issues' && <IssuesTab templateId={templateId} />}
      </div>
    </div>
  );
}

// ============================================
// PAGES TAB
// ============================================

function PagesTab({ templateId, crawlRunId }: { templateId: string; crawlRunId: string }) {
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
      
      const response = await apiFetch<PaginatedResponse<PageItem>>(`/templates/${templateId}/pages?${params}`);
      setData(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId, page, pageSize, search, statusFilter, hasIssuesFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
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
      onRowClick={(item) => router.push(`/pages/${item.pageId}?runId=${crawlRunId}`)}
      rowKey={(item) => item.pageId}
      emptyMessage="No pages in this template"
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

function IssuesTab({ templateId }: { templateId: string }) {
  const [data, setData] = useState<IssueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // Fetch data to get available issue types
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (typeFilter) params.set('type', typeFilter);
      if (severityFilter) params.set('severity', severityFilter);
      
      const response = await apiFetch<PaginatedResponse<IssueItem>>(`/templates/${templateId}/issues?${params}`);
      setData(response.items);
      setTotal(response.total);

      // Extract unique types for filter (from first page only)
      if (page === 1 && !typeFilter && !severityFilter) {
        const types = [...new Set(response.items.map(i => i.type))];
        setAvailableTypes(prev => {
          const combined = [...new Set([...prev, ...types])];
          return combined;
        });
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId, page, pageSize, typeFilter, severityFilter]);

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

  const typeOptions = availableTypes.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }));

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
      rowKey={(item) => item.issueId}
      emptyMessage="No issues found for this template 🎉"
      emptyIcon="✅"
      filters={
        <>
          <FilterSelect
            value={severityFilter}
            onChange={setSeverityFilter}
            options={severityOptions}
            placeholder="All Severities"
          />
          {typeOptions.length > 0 && (
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              placeholder="All Types"
            />
          )}
        </>
      }
    />
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
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
      </div>
      <div className="h-10 bg-gray-200 rounded animate-pulse" />
      <div className="bg-white rounded-lg border border-gray-200 h-96 animate-pulse" />
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

// ============================================
// PAGE EXPORT
// ============================================

export default function TemplateDetailPage() {
  return (
    <Protected>
      <AppShell>
        <TemplateDetailContent />
      </AppShell>
    </Protected>
  );
}
