import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from './api';

interface CrawlRunStatus {
  id: string;
  status: string;
  totalPages: number;
  totalIssues: number;
  startedAt: string | null;
  finishedAt: string | null;
}

interface UseCrawlProgressOptions {
  crawlRunId: string | null;
  enabled?: boolean;
  interval?: number;
  onComplete?: (run: CrawlRunStatus) => void;
}

export function useCrawlProgress({
  crawlRunId,
  enabled = true,
  interval = 3000,
  onComplete,
}: UseCrawlProgressOptions) {
  const [run, setRun] = useState<CrawlRunStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isActive = run?.status === 'RUNNING' || run?.status === 'QUEUED';

  const fetchStatus = useCallback(async () => {
    if (!crawlRunId) return;
    try {
      const data = await apiFetch<CrawlRunStatus>(`/crawl/runs/${crawlRunId}`);
      setRun(data);
      if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        setIsPolling(false);
        onCompleteRef.current?.(data);
      }
    } catch {
      // Silently fail — next poll will retry
    }
  }, [crawlRunId]);

  useEffect(() => {
    if (!crawlRunId || !enabled) return;
    fetchStatus();
    setIsPolling(true);
  }, [crawlRunId, enabled, fetchStatus]);

  useEffect(() => {
    if (!isPolling || !crawlRunId) return;
    const timer = setInterval(fetchStatus, interval);
    return () => clearInterval(timer);
  }, [isPolling, crawlRunId, interval, fetchStatus]);

  return { run, isActive, isPolling, refresh: fetchStatus };
}
