'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { apiFetch, orgsApi, projectsApi } from '@/lib/api';
import { isDemoMode, DEMO_ORGS, DEMO_PROJECTS, DEMO_CRAWL_RUNS, DEMO_STATS } from '@/lib/demo';

interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
  lastCrawl?: {
    id: string;
    status: string;
    totalPages: number;
    totalIssues: number;
    createdAt: string;
  };
}

interface DashboardStats {
  totalProjects: number;
  totalCrawls: number;
  totalPages: number;
  totalIssues: number;
}

function DashboardContent() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalProjects: 0, totalCrawls: 0, totalPages: 0, totalIssues: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    // Demo mode — show mock data immediately
    if (isDemoMode()) {
      setOrgName(DEMO_ORGS[0].name);
      const demoProjectsWithCrawls: ProjectSummary[] = DEMO_PROJECTS.map((proj) => {
        const crawl = DEMO_CRAWL_RUNS.find((r) => r.projectId === proj.id);
        return { id: proj.id, name: proj.name, domain: proj.domain, lastCrawl: crawl };
      });
      setProjects(demoProjectsWithCrawls);
      setStats(DEMO_STATS);
      setIsLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        const [orgs, projectList] = await Promise.all([
          orgsApi.list(),
          projectsApi.list(),
        ]);

        if (orgs.length > 0) setOrgName(orgs[0].name);

        const projectsWithCrawls: ProjectSummary[] = await Promise.all(
          projectList.map(async (proj) => {
            try {
              const crawls = await apiFetch<Array<{
                id: string; status: string; totalPages: number; totalIssues: number; createdAt: string;
              }>>(`/crawl/runs?projectId=${proj.id}&page=1&pageSize=1`);
              const items = Array.isArray(crawls) ? crawls : (crawls as any)?.items ?? [];
              return { id: proj.id, name: proj.name, domain: proj.domain, lastCrawl: items[0] || undefined };
            } catch {
              return { id: proj.id, name: proj.name, domain: proj.domain };
            }
          }),
        );

        setProjects(projectsWithCrawls);
        setStats({
          totalProjects: projectsWithCrawls.length,
          totalCrawls: projectsWithCrawls.filter((p) => p.lastCrawl).length,
          totalPages: projectsWithCrawls.reduce((sum, p) => sum + (p.lastCrawl?.totalPages ?? 0), 0),
          totalIssues: projectsWithCrawls.reduce((sum, p) => sum + (p.lastCrawl?.totalIssues ?? 0), 0),
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  // Health score: simple heuristic from pages vs issues
  const healthScore = stats.totalPages > 0
    ? Math.max(0, Math.round(100 - (stats.totalIssues / stats.totalPages) * 100))
    : 100;
  const healthColor = healthScore >= 80 ? 'text-green-500' : healthScore >= 50 ? 'text-yellow-500' : 'text-red-500';
  const healthRingColor = healthScore >= 80 ? 'stroke-green-500' : healthScore >= 50 ? 'stroke-yellow-500' : 'stroke-red-500';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {orgName ? `${orgName} Dashboard` : 'Dashboard'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your SEO health across all projects</p>
      </div>

      {/* Health Score + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Health Ring */}
        <div className="md:col-span-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 mb-2">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                className="stroke-gray-200 dark:stroke-gray-800"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                className={healthRingColor}
                strokeWidth="3"
                strokeDasharray={`${healthScore}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
            </div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Health Score</span>
        </div>

        {/* Stats Grid */}
        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Projects" value={stats.totalProjects} icon="📁" />
          <StatCard label="Total Crawls" value={stats.totalCrawls} icon="🕷️" />
          <StatCard label="Pages Crawled" value={stats.totalPages} icon="📄" />
          <StatCard label="Open Issues" value={stats.totalIssues} icon="⚠️" highlight={stats.totalIssues > 0} />
        </div>
      </div>

      {/* Projects Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Projects</h2>
          <Link href="/projects" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
            View all
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first project to start crawling</p>
            <Link href="/projects" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md dark:hover:shadow-blue-900/10 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{project.domain}</p>
                  </div>
                  {project.lastCrawl && <CrawlStatusBadge status={project.lastCrawl.status} />}
                </div>
                {project.lastCrawl ? (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Pages</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">{project.lastCrawl.totalPages}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Issues</div>
                      <div className={`text-lg font-semibold ${project.lastCrawl.totalIssues > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {project.lastCrawl.totalIssues}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-400 dark:text-gray-500">No crawls yet</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction href="/projects" icon="📁" label="Manage Projects" />
          <QuickAction href="/tools" icon="🛠️" label="SEO Tools" />
          <QuickAction href="/studio" icon="✨" label="Marketing Studio" />
          <QuickAction href="/flags" icon="🚩" label="Feature Flags" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 ${highlight ? 'border-orange-200 dark:border-orange-800' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
        <span>{icon}</span>{label}
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </Link>
  );
}

function CrawlStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    QUEUED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
      {status.toLowerCase()}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48 animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-72 mt-2 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 h-36 animate-pulse" />
        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 h-40 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Protected>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </Protected>
  );
}
