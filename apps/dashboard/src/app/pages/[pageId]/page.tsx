'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { StatusBadge, SeverityBadge } from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface PageDetails {
  pageId: string;
  url: string;
  normalizedUrl: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number | null;
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
  htmlHash: string | null;
  redirectChainJson: unknown;
  discoveredAt: string;
  issues: IssueItem[];
  outgoingLinks: LinkItem[];
  inlinks: InlinkItem[];
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
  evidenceJson?: unknown;
}

interface LinkItem {
  linkId: string;
  toUrl: string;
  linkType: string;
  isBroken: boolean;
  statusCode: number | null;
}

interface InlinkItem {
  linkId: string;
  fromPageId: string | null;
  fromUrl: string | null;
}

// ============================================
// MAIN COMPONENT
// ============================================

function PageDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params.pageId as string;
  const runId = searchParams.get('runId');

  const [page, setPage] = useState<PageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const data = await apiFetch<PageDetails>(`/pages/${pageId}/details`);
        setPage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load page details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPage();
  }, [pageId]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !page) {
    return (
      <div className="space-y-4">
        <BackLink runId={runId} />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Page not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <BackLink runId={runId} />

      {/* Header Section */}
      <PageHeader page={page} />

      {/* Meta Overview Cards */}
      <MetaOverview page={page} />

      {/* Issues Panel */}
      <IssuesPanel issues={page.issues} />

      {/* Links Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OutgoingLinksPanel links={page.outgoingLinks} />
        <InlinksPanel links={page.inlinks} />
      </div>
    </div>
  );
}

// ============================================
// BACK LINK
// ============================================

function BackLink({ runId }: { runId: string | null }) {
  return (
    <Link
      href={runId ? `/crawls/${runId}` : '/projects'}
      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      {runId ? 'Back to Crawl Run' : 'Back to Projects'}
    </Link>
  );
}

// ============================================
// PAGE HEADER
// ============================================

function PageHeader({ page }: { page: PageDetails }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {page.title || '(No title)'}
            </h1>
            <StatusBadge code={page.statusCode} />
          </div>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
          >
            {page.url}
            <ExternalLinkIcon className="inline-block w-3 h-3 ml-1" />
          </a>
        </div>
      </div>

      {page.metaDescription && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Meta Description
          </span>
          <p className="mt-1 text-sm text-gray-700">{page.metaDescription}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// META OVERVIEW
// ============================================

function MetaOverview({ page }: { page: PageDetails }) {
  const items = [
    {
      label: 'Status Code',
      value: page.statusCode ?? 'N/A',
      icon: '🔢',
      highlight: page.statusCode && page.statusCode >= 400,
    },
    {
      label: 'Word Count',
      value: page.wordCount ?? 'N/A',
      icon: '📝',
      highlight: page.wordCount !== null && page.wordCount < 300,
    },
    {
      label: 'H1 Tags',
      value: page.h1Count ?? 'N/A',
      icon: '🏷️',
      highlight: page.h1Count === 0 || (page.h1Count !== null && page.h1Count > 1),
    },
    {
      label: 'Content Type',
      value: page.contentType ?? 'N/A',
      icon: '📄',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className={`bg-white rounded-lg border p-4 ${
              item.highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <span>{item.icon}</span>
              {item.label}
            </div>
            <div className={`text-xl font-semibold ${item.highlight ? 'text-orange-700' : 'text-gray-900'}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Technical Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Technical Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <DetailRow
            label="Canonical URL"
            value={page.canonical}
            status={page.canonical ? 'set' : 'missing'}
          />
          <DetailRow
            label="Robots Meta"
            value={page.robotsMeta}
            status={page.robotsMeta?.includes('noindex') ? 'warning' : 'default'}
          />
          <DetailRow
            label="Discovered At"
            value={new Date(page.discoveredAt).toLocaleString()}
          />
          {page.redirectChainJson != null && (
            <DetailRow
              label="Redirect Chain"
              value={`${Array.isArray(page.redirectChainJson) ? page.redirectChainJson.length : 0} hop(s)`}
              status="warning"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  status = 'default',
}: {
  label: string;
  value: string | null | undefined;
  status?: 'default' | 'set' | 'missing' | 'warning';
}) {
  const statusColors = {
    default: 'text-gray-900',
    set: 'text-green-700',
    missing: 'text-orange-600',
    warning: 'text-orange-600',
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`mt-0.5 truncate ${statusColors[status]}`}>
        {value || (status === 'missing' ? '⚠️ Not set' : '-')}
      </span>
    </div>
  );
}

// ============================================
// ISSUES PANEL
// ============================================

function IssuesPanel({ issues }: { issues: IssueItem[] }) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedIssues = [...issues].sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
      (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Issues
            {issues.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({issues.length})
              </span>
            )}
          </h2>
          {issues.length > 0 && (
            <div className="flex items-center gap-2">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
                const count = issues.filter((i) => i.severity === sev).length;
                if (count === 0) return null;
                return (
                  <span
                    key={sev}
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      sev === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : sev === 'HIGH'
                        ? 'bg-orange-100 text-orange-700'
                        : sev === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {count} {sev.toLowerCase()}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-gray-600">No issues found for this page</div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {sortedIssues.map((issue) => (
            <IssueCard
              key={issue.issueId}
              issue={issue}
              isExpanded={expandedIssues.has(issue.issueId)}
              onToggle={() => toggleIssue(issue.issueId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  isExpanded,
  onToggle,
}: {
  issue: IssueItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-6 py-4">
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className="mt-0.5">
          <SeverityBadge severity={issue.severity} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{issue.title}</h3>
            <span className="text-xs font-mono text-gray-400">{issue.type}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{issue.description}</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <ChevronIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 ml-12 space-y-4">
          {/* Recommendation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-1">
              <LightbulbIcon className="w-4 h-4" />
              Recommendation
            </div>
            <p className="text-sm text-blue-700">{issue.recommendation}</p>
          </div>

          {/* Evidence JSON (if available) */}
          {issue.evidenceJson != null && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <CodeIcon className="w-4 h-4" />
                Evidence
              </div>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(issue.evidenceJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// OUTGOING LINKS PANEL
// ============================================

function OutgoingLinksPanel({ links }: { links: LinkItem[] }) {
  const [filter, setFilter] = useState<'all' | 'broken'>('all');
  const filteredLinks = filter === 'broken' ? links.filter((l) => l.isBroken) : links;
  const brokenCount = links.filter((l) => l.isBroken).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col max-h-[500px]">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Outgoing Links
            <span className="ml-1.5 text-gray-500 font-normal">({links.length})</span>
          </h2>
          {brokenCount > 0 && (
            <button
              onClick={() => setFilter(filter === 'all' ? 'broken' : 'all')}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                filter === 'broken'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter === 'broken' ? '✕ Clear filter' : `${brokenCount} broken`}
            </button>
          )}
        </div>
      </div>

      {filteredLinks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8 text-gray-500 text-sm">
          {links.length === 0 ? 'No outgoing links' : 'No broken links'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  URL
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLinks.map((link) => (
                <tr key={link.linkId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {link.isBroken && (
                        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" title="Broken" />
                      )}
                      <a
                        href={link.toUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`truncate max-w-xs ${
                          link.isBroken ? 'text-red-600' : 'text-gray-700'
                        } hover:underline`}
                        title={link.toUrl}
                      >
                        {link.toUrl}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <LinkTypeBadge type={link.linkType} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge code={link.statusCode} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// INLINKS PANEL
// ============================================

function InlinksPanel({ links }: { links: InlinkItem[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col max-h-[500px]">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">
          Inlinks
          <span className="ml-1.5 text-gray-500 font-normal">({links.length})</span>
        </h2>
      </div>

      {links.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8 text-gray-500 text-sm">
          No inlinks found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Source Page
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link) => (
                <tr key={link.linkId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {link.fromUrl ? (
                      <a
                        href={link.fromUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-blue-600 hover:underline truncate block max-w-md"
                        title={link.fromUrl}
                      >
                        {link.fromUrl}
                      </a>
                    ) : (
                      <span className="text-gray-400">Unknown source</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// LINK TYPE BADGE
// ============================================

function LinkTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    a: 'bg-blue-100 text-blue-700',
    img: 'bg-purple-100 text-purple-700',
    script: 'bg-yellow-100 text-yellow-700',
    link: 'bg-green-100 text-green-700',
    form: 'bg-orange-100 text-orange-700',
  };

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
        colors[type.toLowerCase()] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {type}
    </span>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-6 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-96 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 h-48 animate-pulse" />
        <div className="bg-white rounded-lg border border-gray-200 h-48 animate-pulse" />
      </div>
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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function PageDetailsPage() {
  return (
    <Protected>
      <AppShell>
        <PageDetailsContent />
      </AppShell>
    </Protected>
  );
}
