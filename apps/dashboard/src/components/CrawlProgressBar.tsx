'use client';

interface CrawlProgressBarProps {
  status: string;
  totalPages: number;
  totalIssues: number;
  startedAt: string | null;
  className?: string;
}

export function CrawlProgressBar({
  status,
  totalPages,
  totalIssues,
  startedAt,
  className = '',
}: CrawlProgressBarProps) {
  const isActive = status === 'RUNNING' || status === 'QUEUED';
  const elapsed = startedAt ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (!isActive) return null;

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {status === 'QUEUED' ? 'Crawl queued...' : 'Crawling in progress...'}
          </span>
        </div>
        <span className="text-xs text-blue-600 dark:text-blue-300 font-mono">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>

      {/* Progress bar (indeterminate for active crawl) */}
      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: status === 'QUEUED' ? '10%' : '60%' }} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-2 text-xs text-blue-700 dark:text-blue-300">
        <span>{totalPages} pages crawled</span>
        <span>{totalIssues} issues found</span>
      </div>
    </div>
  );
}
