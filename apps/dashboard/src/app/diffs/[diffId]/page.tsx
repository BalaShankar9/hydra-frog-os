'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { DiffSummaryCards, DiffItemsTable } from '@/components/DiffView';
import { DiffResponse, fetchDiffById } from '@/lib/diff';

function DiffDetailContent() {
  const params = useParams();
  const router = useRouter();
  const diffId = params.diffId as string;

  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDiff = async () => {
      try {
        const data = await fetchDiffById(diffId);
        setDiff(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      } finally {
        setIsLoading(false);
      }
    };
    loadDiff();
  }, [diffId]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !diff) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" /> Go Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error || 'Diff not found'}</div>
      </div>
    );
  }

  const summary = diff.summaryJson;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/projects/${diff.projectId}`} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Project
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Crawl Comparison</h1>
          {summary && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              summary.regressions > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {summary.regressions > 0 ? `${summary.regressions} regressions` : 'No regressions'}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          Comparing changes between two crawl runs
        </p>
      </div>

      {/* Run Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">From (Previous Run)</div>
            <Link href={`/crawls/${diff.fromRunId}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {diff.fromRunId.slice(0, 8)}...
            </Link>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">To (Current Run)</div>
            <Link href={`/crawls/${diff.toRunId}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {diff.toRunId.slice(0, 8)}...
            </Link>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Comparison created: {new Date(diff.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <DiffSummaryCards summary={summary} fromRunId={diff.fromRunId} toRunId={diff.toRunId} />

      {/* Diff Items Table */}
      {summary && summary.totalItems > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Changes</h2>
          <DiffItemsTable diffId={diffId} />
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 h-96 animate-pulse" />
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

export default function DiffDetailPage() {
  return (
    <Protected>
      <AppShell>
        <DiffDetailContent />
      </AppShell>
    </Protected>
  );
}
