'use client';

import { ReactNode, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortKey?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
  emptyMessage?: string;
  emptyIcon?: string;
  filters?: ReactNode;
  onSort?: (sort: SortState) => void;
  sort?: SortState;
  exportFilename?: string;
  exportColumns?: { key: string; header: string }[];
}

// ============================================
// CSV EXPORT UTILITY
// ============================================

function exportToCsv<T>(data: T[], columns: { key: string; header: string }[], filename: string) {
  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const val = (item as Record<string, unknown>)[col.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap if contains comma/newline/quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }),
  );

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// DATA TABLE COMPONENT
// ============================================

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onRowClick,
  rowKey,
  emptyMessage = 'No data found',
  emptyIcon = '📭',
  filters,
  onSort,
  sort,
  exportFilename,
  exportColumns,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const handleSort = useCallback(
    (key: string) => {
      if (!onSort) return;
      if (sort?.key === key) {
        const next: SortDirection = sort.direction === 'asc' ? 'desc' : sort.direction === 'desc' ? null : 'asc';
        onSort(next ? { key, direction: next } : { key: '', direction: null });
      } else {
        onSort({ key, direction: 'asc' });
      }
    },
    [onSort, sort],
  );

  const handleExport = useCallback(() => {
    if (!exportFilename) return;
    const cols = exportColumns || columns.map((c) => ({ key: c.key, header: c.header }));
    exportToCsv(data, cols, exportFilename);
  }, [data, columns, exportFilename, exportColumns]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      {/* Toolbar */}
      {(onSearchChange || filters || exportFilename) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          )}
          {filters}
          {exportFilename && data.length > 0 && (
            <button
              onClick={handleExport}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              aria-label="Export to CSV"
            >
              <DownloadIcon className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable && onSort;
                const sortKey = col.sortKey || col.key;
                const isActive = sort?.key === sortKey;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.className || ''} ${isSortable ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''}`}
                    onClick={isSortable ? () => handleSort(sortKey) : undefined}
                    aria-sort={isActive ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {isSortable && (
                        <span className="inline-flex flex-col">
                          <ChevronUpMiniIcon className={`w-3 h-3 ${isActive && sort?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          <ChevronDownMiniIcon className={`w-3 h-3 -mt-1 ${isActive && sort?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">{emptyIcon}</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={rowKey(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} transition-colors`}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(item); } : undefined}
                  role={onRowClick ? 'button' : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${col.className || ''}`}>
                      {col.render ? col.render(item, index) : (item as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Showing {startItem}-{endItem} of {total}</span>
            {onPageSizeChange && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  aria-label="Rows per page"
                >
                  {[25, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button onClick={() => onPageChange(1)} disabled={page === 1} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="First page">
              <ChevronsLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Previous page">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Next page">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Last page">
              <ChevronsRightIcon className="w-4 h-4" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

// ============================================
// FILTER SELECT COMPONENT
// ============================================

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function FilterSelect({ value, onChange, options, placeholder = 'All', className }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${className || ''}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ============================================
// FILTER TOGGLE COMPONENT
// ============================================

interface FilterToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function FilterToggle({ label, checked, onChange }: FilterToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

// ============================================
// ICONS
// ============================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronsLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function ChevronsRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function ChevronUpMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

// ============================================
// STATUS BADGE
// ============================================

interface StatusBadgeProps {
  code: number | null;
}

export function StatusBadge({ code }: StatusBadgeProps) {
  if (code === null) return <span className="text-gray-400 dark:text-gray-500">-</span>;

  let colorClass = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  if (code >= 200 && code < 300) colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  else if (code >= 300 && code < 400) colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  else if (code >= 400 && code < 500) colorClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  else if (code >= 500) colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {code}
    </span>
  );
}

// ============================================
// SEVERITY BADGE
// ============================================

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[severity] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
      {severity}
    </span>
  );
}
