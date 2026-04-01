'use client';

import { useState, useEffect } from 'react';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { apiFetch, projectsApi } from '@/lib/api';

interface Project { id: string; name: string; domain: string; }
interface CrawlRun { id: string; status: string; totalPages: number; totalIssues: number; createdAt: string; }

interface ComparisonResult {
  yourDomain: DomainSummary;
  competitor: DomainSummary;
  advantages: ComparisonItem[];
  gaps: ComparisonItem[];
  opportunities: string[];
}

interface DomainSummary {
  domain: string;
  totalPages: number;
  totalIssues: number;
  avgWordCount: number;
  pagesWithH1: number;
  pagesWithCanonical: number;
  pagesWithMetaDesc: number;
}

interface ComparisonItem {
  metric: string;
  yours: number | string;
  theirs: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

function CompetitorContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [yourProject, setYourProject] = useState('');
  const [yourCrawl, setYourCrawl] = useState('');
  const [compProject, setCompProject] = useState('');
  const [compCrawl, setCompCrawl] = useState('');
  const [yourCrawls, setYourCrawls] = useState<CrawlRun[]>([]);
  const [compCrawls, setCompCrawls] = useState<CrawlRun[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { projectsApi.list().then(setProjects).catch(console.error); }, []);

  const fetchCrawls = async (projectId: string, setter: (runs: CrawlRun[]) => void, crawlSetter: (id: string) => void) => {
    if (!projectId) return;
    try {
      const data = await apiFetch<{ items: CrawlRun[] } | CrawlRun[]>(`/crawl/runs?projectId=${projectId}&page=1&pageSize=10`);
      const items = Array.isArray(data) ? data : data.items || [];
      setter(items);
      if (items.length > 0) crawlSetter(items[0].id);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchCrawls(yourProject, setYourCrawls, setYourCrawl); }, [yourProject]);
  useEffect(() => { fetchCrawls(compProject, setCompCrawls, setCompCrawl); }, [compProject]);

  const runComparison = async () => {
    if (!yourProject || !yourCrawl || !compProject || !compCrawl) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiFetch<ComparisonResult>(
        `/competitor/compare?yourProjectId=${yourProject}&yourCrawlRunId=${yourCrawl}&competitorProjectId=${compProject}&competitorCrawlRunId=${compCrawl}`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Competitor Analysis' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Competitor Analysis</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Compare your SEO metrics against a competitor domain</p>
      </div>

      {/* Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Project</label>
            <select value={yourProject} onChange={(e) => setYourProject(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
              <option value="">Select...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>)}
            </select>
            {yourCrawls.length > 0 && (
              <select value={yourCrawl} onChange={(e) => setYourCrawl(e.target.value)} className="w-full mt-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                {yourCrawls.map((r) => <option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleDateString()} — {r.totalPages} pages</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Competitor Project</label>
            <select value={compProject} onChange={(e) => setCompProject(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
              <option value="">Select...</option>
              {projects.filter((p) => p.id !== yourProject).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>)}
            </select>
            {compCrawls.length > 0 && (
              <select value={compCrawl} onChange={(e) => setCompCrawl(e.target.value)} className="w-full mt-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                {compCrawls.map((r) => <option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleDateString()} — {r.totalPages} pages</option>)}
              </select>
            )}
          </div>
        </div>
        <button
          onClick={runComparison}
          disabled={!yourProject || !yourCrawl || !compProject || !compCrawl || isLoading}
          className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {isLoading ? 'Comparing...' : 'Compare'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Side-by-side Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DomainCard domain={result.yourDomain} label="Your Site" color="blue" />
            <DomainCard domain={result.competitor} label="Competitor" color="orange" />
          </div>

          {/* Advantages */}
          {result.advantages.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
              <h2 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-3">Your Advantages</h2>
              <div className="space-y-2">
                {result.advantages.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-green-200 dark:border-green-800 last:border-0">
                    <span className="text-sm text-green-900 dark:text-green-200">{a.metric}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-green-700 dark:text-green-300">{a.yours}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="text-gray-600 dark:text-gray-400">{a.theirs}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-3">Gaps to Close</h2>
              <div className="space-y-2">
                {result.gaps.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-red-200 dark:border-red-800 last:border-0">
                    <span className="text-sm text-red-900 dark:text-red-200">{g.metric}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-red-700 dark:text-red-300">{g.yours}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="text-gray-600 dark:text-gray-400">{g.theirs}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {result.opportunities.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">Opportunities</h2>
              <ul className="space-y-2">
                {result.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-200">
                    <span className="mt-0.5">💡</span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DomainCard({ domain, label, color }: { domain: DomainSummary; label: string; color: 'blue' | 'orange' }) {
  const accent = color === 'blue' ? 'border-blue-300 dark:border-blue-700' : 'border-orange-300 dark:border-orange-700';
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border-2 ${accent} p-5`}>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{domain.domain}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Pages" value={domain.totalPages} />
        <Stat label="Issues" value={domain.totalIssues} warn={domain.totalIssues > 0} />
        <Stat label="Avg Words" value={domain.avgWordCount} />
        <Stat label="With H1" value={domain.pagesWithH1} />
        <Stat label="Canonical" value={domain.pagesWithCanonical} />
        <Stat label="Meta Desc" value={domain.pagesWithMetaDesc} />
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${warn ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function CompetitorPage() {
  return (
    <Protected>
      <AppShell>
        <CompetitorContent />
      </AppShell>
    </Protected>
  );
}
