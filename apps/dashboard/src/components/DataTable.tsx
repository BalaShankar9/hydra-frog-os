'use client';

import { ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
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
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Toolbar */}
      {(onSearchChange || filters) && (
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">{emptyIcon}</div>
                  <p className="text-gray-500 text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              // Data rows
              data.map((item, index) => (
                <tr
                  key={rowKey(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
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
        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Showing {startItem}-{endItem} of {total}</span>
            {onPageSizeChange && (
              <>
                <span className="text-gray-300">|</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {[25, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronsRightIcon className="w-4 h-4" />
            </button>
          </div>
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
      className={`border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${className || ''}`}
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
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
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

// ============================================
// STATUS BADGE COMPONENT
// ============================================

interface StatusBadgeProps {
  code: number | null;
}

export function StatusBadge({ code }: StatusBadgeProps) {
  if (code === null) return <span className="text-gray-400">-</span>;
  
  let colorClass = 'bg-gray-100 text-gray-800';
  if (code >= 200 && code < 300) colorClass = 'bg-green-100 text-green-800';
  else if (code >= 300 && code < 400) colorClass = 'bg-blue-100 text-blue-800';
  else if (code >= 400 && code < 500) colorClass = 'bg-orange-100 text-orange-800';
  else if (code >= 500) colorClass = 'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {code}
    </span>
  );
}

// ============================================
// SEVERITY BADGE COMPONENT
// ============================================

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-blue-100 text-blue-800',
  };
  
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[severity] || 'bg-gray-100 text-gray-800'}`}>
      {severity}
    </span>
  );
}
