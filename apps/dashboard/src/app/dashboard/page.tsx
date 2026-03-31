'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { apiFetch, orgsApi, projectsApi } from '@/lib/api';

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
    const fetchDashboard = async () => {
      try {
        const [orgs, projectList] = await Promise.all([
          orgsApi.list(),
          projectsApi.list(),
        ]);

        if (orgs.length > 0) {
          setOrgName(orgs[0].name);
        }

        // Fetch last crawl for each project
        const projectsWithCrawls: ProjectSummary[] = await Promise.all(
          projectList.map(async (proj) => {
            try {
              const crawls = await apiFetch<Array<{
                id: string;
                status: string;
                totalPages: number;
                totalIssues: number;
                createdAt: string;
              }>>(`/crawl/runs?projectId=${proj.id}&page=1&pageSize=1`);
              const items = Array.isArray(crawls) ? crawls : (crawls as any)?.items ?? [];
              return {
                id: proj.id,
                name: proj.name,
                domain: proj.domain,
                lastCrawl: items[0] || undefined,
              };
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

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {orgName ? `${orgName} Dashboard` : 'Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">Overview of your SEO health across all projects</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Projects" value={stats.totalProjects} icon="📁" />
        <StatCard label="Total Crawls" value={stats.totalCrawls} icon="🕷️" />
        <StatCard label="Pages Crawled" value={stats.totalPages} icon="📄" />
        <StatCard
          label="Open Issues"
          value={stats.totalIssues}
          icon="⚠️"
          highlight={stats.totalIssues > 0}
        />
      </div>

      {/* Projects Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <Link
            href="/projects"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Create your first project to start crawling</p>
            <Link
              href="/projects"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{project.domain}</p>
                  </div>
                  {project.lastCrawl && (
                    <CrawlStatusBadge status={project.lastCrawl.status} />
                  )}
                </div>

                {project.lastCrawl ? (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500">Pages</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {project.lastCrawl.totalPages}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Issues</div>
                      <div className={`text-lg font-semibold ${project.lastCrawl.totalIssues > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {project.lastCrawl.totalIssues}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-400">No crawls yet</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
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

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${highlight ? 'border-orange-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}

function CrawlStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    FAILED: 'bg-red-100 text-red-700',
    QUEUED: 'bg-yellow-100 text-yellow-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.toLowerCase()}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-72 mt-2 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div>
        <div className="h-6 bg-gray-200 rounded w-24 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-40 animate-pulse" />
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
