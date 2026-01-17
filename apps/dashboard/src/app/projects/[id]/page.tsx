'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Project {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  startUrl: string;
  createdAt: string;
}

interface CrawlRunTotals {
  pagesCrawled?: number;
  issueCountTotal?: number;
  brokenInternalLinksCount?: number;
}

interface CrawlRun {
  id: string;
  projectId: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED';
  startedAt: string | null;
  finishedAt: string | null;
  totalsJson: CrawlRunTotals;
  createdAt: string;
}

interface Schedule {
  id: string;
  projectId: string;
  frequency: 'MANUAL' | 'DAILY' | 'WEEKLY';
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await apiFetch<Project>(`/projects/${projectId}`);
        setProject(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const fetchCrawlRuns = useCallback(async () => {
    try {
      const data = await apiFetch<CrawlRun[]>(`/projects/${projectId}/crawls`);
      setCrawlRuns(data);
      return data;
    } catch (err) {
      console.error('Failed to load crawl runs:', err);
      return [];
    }
  }, [projectId]);

  const fetchSchedule = useCallback(async () => {
    try {
      const data = await apiFetch<Schedule>(`/projects/${projectId}/schedule`);
      setSchedule(data);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    }
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    setIsLoadingRuns(true);
    Promise.all([fetchCrawlRuns(), fetchSchedule()]).finally(() => {
      setIsLoadingRuns(false);
    });
  }, [project, fetchCrawlRuns, fetchSchedule]);

  useEffect(() => {
    const hasActiveCrawl = crawlRuns.some(r => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (hasActiveCrawl && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const runs = await fetchCrawlRuns();
        const stillActive = runs.some(r => r.status === 'QUEUED' || r.status === 'RUNNING');
        if (!stillActive && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 2000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [crawlRuns, fetchCrawlRuns]);

  const handleRunNow = async () => {
    setIsStartingCrawl(true);
    setError('');
    try {
      const newRun = await apiFetch<CrawlRun>(`/projects/${projectId}/crawls/run-now`, { method: 'POST' });
      setCrawlRuns(prev => [newRun, ...prev]);
      toast.success('Crawl started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start crawl';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsStartingCrawl(false);
    }
  };

  const handleCancel = async () => {
    const activeCrawl = crawlRuns.find(r => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!activeCrawl) return;
    setIsCancelling(true);
    setError('');
    try {
      await apiFetch(`/projects/${projectId}/crawls/cancel`, { method: 'POST', body: { crawlRunId: activeCrawl.id } });
      await fetchCrawlRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel crawl');
    } finally {
      setIsCancelling(false);
    }
  };

  const latestRun = crawlRuns[0];
  const canCancel = latestRun && (latestRun.status === 'QUEUED' || latestRun.status === 'RUNNING');
  const isRunning = crawlRuns.some(r => r.status === 'QUEUED' || r.status === 'RUNNING');

  if (isLoading) return <LoadingSkeleton />;
  if (error && !project) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/projects')} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Projects
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700"><XIcon className="w-5 h-5" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
            <ArrowLeftIcon className="w-4 h-4" /> Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500 mt-1">{project.domain}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} disabled={!canCancel || isCancelling}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${canCancel && !isCancelling ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <StopIcon className="w-5 h-5" />{isCancelling ? 'Cancelling...' : 'Cancel Run'}
          </button>
          <button onClick={handleRunNow} disabled={isStartingCrawl || isRunning}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isStartingCrawl || isRunning ? 'bg-green-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            <PlayIcon className="w-5 h-5" />{isStartingCrawl ? 'Starting...' : isRunning ? 'Running...' : 'Run Now'}
          </button>
        </div>
      </div>

      <ScheduleCard projectId={projectId} schedule={schedule} onUpdate={setSchedule} />

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Crawl Runs</h2>
        </div>
        {isLoadingRuns ? (
          <div className="p-6"><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div></div>
        ) : crawlRuns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🕷️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No crawls yet</h3>
            <p className="text-gray-500 mb-4">Start your first crawl to analyze this website.</p>
            <button onClick={handleRunNow} disabled={isStartingCrawl} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
              <PlayIcon className="w-5 h-5" />Run Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broken Links</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {crawlRuns.map(run => <CrawlRunTableRow key={run.id} run={run} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleCardProps { projectId: string; schedule: Schedule | null; onUpdate: (s: Schedule) => void; }

function ScheduleCard({ projectId, schedule, onUpdate }: ScheduleCardProps) {
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [frequency, setFrequency] = useState<'MANUAL' | 'DAILY' | 'WEEKLY'>(schedule?.frequency ?? 'MANUAL');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const toast = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { if (schedule) { setEnabled(schedule.enabled); setFrequency(schedule.frequency); } }, [schedule]);
  useEffect(() => {
    const changed = schedule ? (enabled !== schedule.enabled || frequency !== schedule.frequency) : (enabled || frequency !== 'MANUAL');
    setHasChanges(changed);
  }, [enabled, frequency, schedule]);

  const handleSave = async () => {
    setIsSaving(true); setSaveError('');
    try {
      const updated = await apiFetch<Schedule>(`/projects/${projectId}/schedule`, { method: 'PATCH', body: { enabled, frequency } });
      onUpdate(updated); setHasChanges(false);
      toast.success('Schedule updated');
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Failed to update schedule'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
        {hasChanges && (
          <button onClick={handleSave} disabled={isSaving} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isSaving ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>
      {saveError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm text-gray-500 mb-2">Scheduling</label>
          <button onClick={() => setEnabled(!enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="ml-3 text-sm text-gray-700">{enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-2">Frequency</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value as 'MANUAL' | 'DAILY' | 'WEEKLY')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
            <option value="MANUAL">Manual</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-2">Last Run</label>
          <p className="text-sm font-medium text-gray-900">{schedule?.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'Never'}</p>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-2">Next Run</label>
          <p className="text-sm font-medium text-gray-900">
            {schedule?.nextRunAt && enabled && frequency !== 'MANUAL' ? new Date(schedule.nextRunAt).toLocaleString() : frequency === 'MANUAL' ? 'Manual only' : 'Not scheduled'}
          </p>
        </div>
      </div>
    </div>
  );
}

function CrawlRunTableRow({ run }: { run: CrawlRun }) {
  const statusColors: Record<string, string> = { QUEUED: 'bg-yellow-100 text-yellow-800', RUNNING: 'bg-blue-100 text-blue-800', DONE: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-800', CANCELED: 'bg-gray-100 text-gray-800' };
  const totals = run.totalsJson || {};
  const duration = run.startedAt && run.finishedAt ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000) : null;
  const formatDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{new Date(run.createdAt).toLocaleDateString()}</div>
        <div className="text-xs text-gray-500">{new Date(run.createdAt).toLocaleTimeString()}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[run.status] || 'bg-gray-100'}`}>
          {run.status === 'RUNNING' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
          {run.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{totals.pagesCrawled ?? '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{totals.issueCountTotal ?? '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{totals.brokenInternalLinksCount ?? '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {run.status === 'RUNNING' ? <span className="text-blue-600">In progress...</span> : duration !== null ? formatDuration(duration) : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Link href={`/crawls/${run.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
          View <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div><div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" /><div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse" /><div className="h-4 bg-gray-200 rounded w-48 animate-pulse" /></div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"><div className="h-6 bg-gray-200 rounded w-24 mb-4" /><div className="grid grid-cols-4 gap-6">{[1,2,3,4].map(i => <div key={i}><div className="h-4 bg-gray-200 rounded w-20 mb-2" /><div className="h-6 bg-gray-100 rounded w-full" /></div>)}</div></div>
      <div className="bg-white rounded-lg border border-gray-200 animate-pulse"><div className="px-6 py-4 border-b border-gray-200"><div className="h-6 bg-gray-200 rounded w-32" /></div><div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded" />)}</div></div>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
}
function ArrowRightIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>;
}
function PlayIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function StopIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>;
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

export default function ProjectDetailPage() {
  return <Protected><AppShell><ProjectDetailContent /></AppShell></Protected>;
}
