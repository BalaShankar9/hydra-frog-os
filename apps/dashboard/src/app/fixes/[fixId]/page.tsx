'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';

interface FixDetail {
  id: string;
  crawlRunId: string;
  projectId: string;
  templateId: string | null;
  fixType: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priorityScore: number | null;
  impactScore: number | null;
  effortScore: number | null;
  title: string;
  summary: string;
  recommendation: string;
  evidenceJson: Record<string, unknown> | null;
  affectedPagesCount: number;
  createdAt: string;
  updatedAt: string;
  templateName: string | null;
  items: Array<{
    id: string;
    pageId: string | null;
    url: string;
    normalizedUrl: string | null;
    issueId: string | null;
    perfAuditId: string | null;
    createdAt: string;
  }>;
}

function FixDetailContent() {
  const params = useParams();
  const toast = useToast();
  const fixId = params.fixId as string;

  const [fix, setFix] = useState<FixDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchFix = async () => {
      try {
        const data = await apiFetch<FixDetail>(`/fixes/${fixId}`);
        setFix(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fix');
      } finally {
        setIsLoading(false);
      }
    };
    fetchFix();
  }, [fixId]);

  const updateStatus = async (newStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE') => {
    if (!fix) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/fixes/${fixId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setFix({ ...fix, status: newStatus });
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100 text-red-800 border-red-200';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DONE': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 15) return 'text-red-600';
    if (score >= 10) return 'text-orange-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatFixType = (type: string) => {
    return type.replace('FIX_', '').replace(/_/g, ' ').toLowerCase()
      .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
        <div className="h-48 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !fix) {
    return (
      <div className="space-y-4">
        <Link href="/projects" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          ← Back to Projects
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Fix not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/crawls/${fix.crawlRunId}`} className="text-blue-600 hover:text-blue-800">
          ← Back to Crawl Run
        </Link>
        <span className="text-gray-400">|</span>
        <span className="text-gray-500">Fix #{fix.id.slice(0, 8)}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔧</span>
              <h1 className="text-2xl font-bold text-gray-900">{fix.title}</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded">{formatFixType(fix.fixType)}</span>
              <span>•</span>
              <span>{fix.templateName ?? 'Global (all pages)'}</span>
              <span>•</span>
              <span>{fix.affectedPagesCount} pages affected</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={fix.status}
              onChange={(e) => updateStatus(e.target.value as 'OPEN' | 'IN_PROGRESS' | 'DONE')}
              disabled={updatingStatus}
              className={`px-4 py-2 rounded-lg border font-medium cursor-pointer ${getStatusColor(fix.status)}`}
            >
              <option value="OPEN">🔴 Open</option>
              <option value="IN_PROGRESS">🟡 In Progress</option>
              <option value="DONE">🟢 Done</option>
            </select>
            {updatingStatus && (
              <span className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Priority Score</div>
            <div className={`text-3xl font-bold ${getScoreColor(fix.priorityScore)}`}>
              {fix.priorityScore?.toFixed(1) ?? '-'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Impact</div>
            <div className="text-2xl font-semibold text-gray-900">
              {fix.impactScore?.toFixed(1) ?? '-'} <span className="text-sm text-gray-400">/10</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Effort</div>
            <div className="text-2xl font-semibold text-gray-900">
              {fix.effortScore ?? '-'} <span className="text-sm text-gray-400">/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
        <p className="text-gray-700 leading-relaxed">{fix.summary}</p>
      </div>

      {/* Recommendation Steps */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">📋 Recommended Steps</h2>
        <div className="prose prose-blue max-w-none">
          {fix.recommendation.split('\n').map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            // Check if it's a numbered step
            const stepMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
            if (stepMatch) {
              return (
                <div key={i} className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {stepMatch[1]}
                  </span>
                  <span className="text-gray-700 pt-0.5">{stepMatch[2]}</span>
                </div>
              );
            }
            return <p key={i} className="text-gray-700 mb-2">{trimmed}</p>;
          })}
        </div>
      </div>

      {/* Evidence / Examples */}
      {fix.evidenceJson && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Evidence</h2>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
            {JSON.stringify(fix.evidenceJson, null, 2)}
          </pre>
        </div>
      )}

      {/* Affected Pages */}
      {fix.items.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Example Pages ({fix.items.length} of {fix.affectedPagesCount})
          </h2>
          <div className="space-y-2">
            {fix.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline truncate block"
                  >
                    {item.url}
                  </a>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {item.pageId && (
                    <Link
                      href={`/crawls/${fix.crawlRunId}/pages/${item.pageId}`}
                      className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      View Page
                    </Link>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Open ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-sm text-gray-500 flex items-center justify-between">
        <span>Created: {new Date(fix.createdAt).toLocaleString()}</span>
        <span>Last updated: {new Date(fix.updatedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function FixDetailPage() {
  return (
    <Protected>
      <AppShell>
        <FixDetailContent />
      </AppShell>
    </Protected>
  );
}
