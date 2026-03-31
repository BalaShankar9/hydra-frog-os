'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DiffItem,
  DiffSummaryJson,
  DiffResponse,
  fetchDiffItems,
  DIFF_TYPE_LABELS,
  SEVERITY_COLORS,
  DIRECTION_COLORS,
  formatDiffValue,
  getQuickPreviewFields,
  DiffType,
  DiffSeverity,
  DiffDirection,
  ListDiffItemsParams,
} from '@/lib/diff';

// --- Summary Cards Component ---
interface DiffSummaryCardsProps {
  summary: DiffSummaryJson | null;
  fromRunId: string;
  toRunId: string;
}

export function DiffSummaryCards({ summary, fromRunId, toRunId }: DiffSummaryCardsProps) {
  if (!summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
        No comparison data available for this crawl run.
        {fromRunId && !toRunId && (
          <p className="mt-2 text-sm">This is the first crawl run - nothing to compare against yet.</p>
        )}
      </div>
    );
  }

  const cards = [
    { label: 'Total Changes', value: summary.totalItems, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Regressions', value: summary.regressions, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Improvements', value: summary.improvements, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Neutral', value: summary.neutral, color: 'bg-gray-50 text-gray-700 border-gray-200' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
          <div className="text-sm font-medium opacity-75">{card.label}</div>
          <div className="text-2xl font-bold mt-1">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

// --- Diff Items Table Component ---
interface DiffItemsTableProps {
  diffId: string;
}

export function DiffItemsTable({ diffId }: DiffItemsTableProps) {
  const [items, setItems] = useState<DiffItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const [diffType, setDiffType] = useState<DiffType | ''>('');
  const [severity, setSeverity] = useState<DiffSeverity | ''>('');
  const [direction, setDirection] = useState<DiffDirection | ''>('');
  const [selectedItem, setSelectedItem] = useState<DiffItem | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: ListDiffItemsParams = { page, pageSize };
      if (diffType) params.type = diffType;
      if (severity) params.severity = severity;
      if (direction) params.direction = direction;

      const data = await fetchDiffItems(diffId, params);
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / pageSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff items');
    } finally {
      setIsLoading(false);
    }
  }, [diffId, page, diffType, severity, direction]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setPage(1);
  }, [diffType, severity, direction]);

  const diffTypeOptions: { value: DiffType | ''; label: string }[] = [
    { value: '', label: 'All Types' },
    ...Object.entries(DIFF_TYPE_LABELS).map(([value, label]) => ({ value: value as DiffType, label })),
  ];

  const severityOptions: { value: DiffSeverity | ''; label: string }[] = [
    { value: '', label: 'All Severities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  const directionOptions: { value: DiffDirection | ''; label: string }[] = [
    { value: '', label: 'All Directions' },
    { value: 'REGRESSION', label: 'Regression' },
    { value: 'IMPROVEMENT', label: 'Improvement' },
    { value: 'NEUTRAL', label: 'Neutral' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={diffType}
          onChange={(e) => setDiffType(e.target.value as DiffType | '')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          {diffTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as DiffSeverity | '')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as DiffDirection | '')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          {directionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total} items</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
          <p>Loading changes...</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && items.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <DiffItemRow key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && items.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No changes found matching your filters.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && <DiffItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

// --- Row Component ---
function DiffItemRow({ item, onSelect }: { item: DiffItem; onSelect: () => void }) {
  const quickPreviewFields = getQuickPreviewFields(item.type);
  const severityColor = SEVERITY_COLORS[item.severity] || 'bg-gray-100 text-gray-800';
  const directionColor = DIRECTION_COLORS[item.direction] || 'bg-gray-100 text-gray-800';
  const displayUrl = item.url.length > 50 ? item.url.slice(0, 47) + '...' : item.url;

  const getQuickPreview = (): { field: string; before: string; after: string } | null => {
    if (quickPreviewFields.length === 0) return null;
    const field = quickPreviewFields[0];
    const before = item.beforeJson ? item.beforeJson[field] : null;
    const after = item.afterJson ? item.afterJson[field] : null;
    return { field, before: formatDiffValue(before), after: formatDiffValue(after) };
  };

  const preview = getQuickPreview();

  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={onSelect}>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={item.url}>{displayUrl}</td>
      <td className="px-4 py-3 text-sm">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
          {DIFF_TYPE_LABELS[item.type] || item.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${severityColor}`}>
          {item.severity}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${directionColor}`}>
          {item.direction}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {preview ? (
          <span className="text-xs">
            <span className="text-gray-500">{preview.field}:</span>{' '}
            <span className="bg-red-50 text-red-700 px-1 rounded line-through">{preview.before}</span>
            {' → '}
            <span className="bg-green-50 text-green-700 px-1 rounded">{preview.after}</span>
          </span>
        ) : (
          <span className="text-gray-400">Click to view</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-right">
        <button className="text-blue-600 hover:text-blue-800 text-xs">Details</button>
      </td>
    </tr>
  );
}

// --- Detail Modal Component ---
function DiffItemDetailModal({ item, onClose }: { item: DiffItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Change Details</h3>
            <p className="text-sm text-gray-500 truncate max-w-lg" title={item.url}>{item.url}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Type</div>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                {DIFF_TYPE_LABELS[item.type] || item.type}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Severity</div>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${SEVERITY_COLORS[item.severity]}`}>
                {item.severity}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Direction</div>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${DIRECTION_COLORS[item.direction]}`}>
                {item.direction}
              </span>
            </div>
          </div>

          {/* Before/After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" /> Before
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(item.beforeJson, null, 2)}
                </pre>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" /> After
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(item.afterJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Changes Tab Component (for crawl run page) ---
interface ChangesTabProps {
  runId: string;
  diff: DiffResponse | null;
  isLoading: boolean;
  error?: string;
}

export function ChangesTab({ diff, isLoading, error }: ChangesTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  if (!diff) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-500 mb-2">No comparison available</div>
        <p className="text-sm text-gray-400">This is the first crawl run for this project - nothing to compare against yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DiffSummaryCards
        summary={diff.summaryJson}
        fromRunId={diff.fromRunId}
        toRunId={diff.toRunId}
      />

      {diff.summaryJson && diff.summaryJson.totalItems > 0 && (
        <DiffItemsTable diffId={diff.diffId} />
      )}
    </div>
  );
}
