'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { projectsApi, orgsApi, apiFetch } from '@/lib/api';
import { getActiveOrgId, setActiveOrgId } from '@/lib/org';
import Link from 'next/link';

interface Project {
  id: string;
  orgId: string;
  name: string;
  domain: string;
  startUrl: string;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

const DEFAULT_PROJECT_SETTINGS = {
  maxPages: 1000,
  maxDepth: 5,
  ignoreParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'],
  throttleMs: 100,
  includeSubdomains: false,
};

function ProjectsContent() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const orgsData = await orgsApi.list();
        setOrgs(orgsData);
        const storedOrgId = getActiveOrgId();
        const validOrgId = orgsData.find((o) => o.id === storedOrgId)?.id || orgsData[0]?.id;
        if (validOrgId) {
          setActiveOrgIdState(validOrgId);
          setActiveOrgId(validOrgId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const projectsData = await projectsApi.list({ orgId: activeOrgId });
        setProjects(projectsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [activeOrgId]);

  const handleOrgChange = (orgId: string) => {
    setActiveOrgIdState(orgId);
    setActiveOrgId(orgId);
  };

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    setShowCreateModal(false);
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>;
  if (orgs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">🏢</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations</h3>
        <p className="text-gray-500">You don&apos;t belong to any organizations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <div className="relative">
            <select
              value={activeOrgId || ''}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            >
              {orgs.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          <PlusIcon className="w-5 h-5" />New Project
        </button>
      </div>

      {isLoadingProjects ? (
        <ProjectsLoadingSkeleton />
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-4">Create your first project to start crawling websites.</p>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <PlusIcon className="w-5 h-5" />Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (<ProjectCard key={project.id} project={project} />))}
        </div>
      )}

      {showCreateModal && activeOrgId && (
        <CreateProjectModal orgId={activeOrgId} onClose={() => setShowCreateModal(false)} onCreated={handleProjectCreated} />
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <GlobeIcon className="w-5 h-5 text-blue-600" />
        </div>
        <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{project.name}</h3>
      <p className="text-sm text-gray-500 mb-3 truncate">{project.domain}</p>
      <div className="text-xs text-gray-400">Created {new Date(project.createdAt).toLocaleDateString()}</div>
    </Link>
  );
}

interface CreateProjectModalProps {
  orgId: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

function CreateProjectModal({ orgId, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (domain && !startUrl) {
      setStartUrl(`https://${domain}/`);
    }
  }, [domain, startUrl]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Project name is required';
    if (!domain.trim()) {
      errors.domain = 'Domain is required';
    } else if (domain.includes('://')) {
      errors.domain = 'Domain should not include protocol';
    }
    if (!startUrl.trim()) {
      errors.startUrl = 'Start URL is required';
    } else if (!/^https?:\/\/.+/.test(startUrl)) {
      errors.startUrl = 'Start URL must begin with http:// or https://';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const project = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: { orgId, name: name.trim(), domain: domain.trim(), startUrl: startUrl.trim() },
      });
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Create New Project</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Website"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400 ${validationErrors.name ? 'border-red-300' : 'border-gray-300'}`}
                disabled={isSubmitting} />
              {validationErrors.name && <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input id="domain" type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400 ${validationErrors.domain ? 'border-red-300' : 'border-gray-300'}`}
                disabled={isSubmitting} />
              {validationErrors.domain ? <p className="mt-1 text-sm text-red-600">{validationErrors.domain}</p> : <p className="mt-1 text-xs text-gray-500">Without protocol (e.g., example.com)</p>}
            </div>
            <div>
              <label htmlFor="startUrl" className="block text-sm font-medium text-gray-700 mb-1">Start URL</label>
              <input id="startUrl" type="text" value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="https://example.com/"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400 ${validationErrors.startUrl ? 'border-red-300' : 'border-gray-300'}`}
                disabled={isSubmitting} />
              {validationErrors.startUrl ? <p className="mt-1 text-sm text-red-600">{validationErrors.startUrl}</p> : <p className="mt-1 text-xs text-gray-500">The crawler will start from this URL</p>}
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Default Settings</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>Max Pages: <span className="font-medium">{DEFAULT_PROJECT_SETTINGS.maxPages}</span></div>
                <div>Max Depth: <span className="font-medium">{DEFAULT_PROJECT_SETTINGS.maxDepth}</span></div>
                <div>Throttle: <span className="font-medium">{DEFAULT_PROJECT_SETTINGS.throttleMs}ms</span></div>
                <div>Subdomains: <span className="font-medium">{DEFAULT_PROJECT_SETTINGS.includeSubdomains ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>Cancel</button>
              <button type="submit" disabled={isSubmitting} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse" />
      </div>
      <ProjectsLoadingSkeleton />
    </div>
  );
}

function ProjectsLoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>);
}

function PlusIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>);
}

function GlobeIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>);
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>);
}

function XIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
}

export default function ProjectsPage() {
  return (
    <Protected>
      <AppShell>
        <ProjectsContent />
      </AppShell>
    </Protected>
  );
}
