'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface Org {
  id: string;
  name: string;
  role: string;
}

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  scope: 'GLOBAL' | 'ORG' | 'PROJECT';
  orgId: string | null;
  projectId: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const SCOPE_COLORS: Record<string, string> = {
  GLOBAL: 'bg-purple-100 text-purple-700',
  ORG: 'bg-blue-100 text-blue-700',
  PROJECT: 'bg-green-100 text-green-700',
};

// ============================================
// MAIN CONTENT
// ============================================

function FlagsContent() {
  const toast = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch orgs
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await apiFetch<Org[]>('/orgs');
        setOrgs(data.filter((o) => o.role === 'ADMIN'));
      } catch (err) {
        console.error('Failed to fetch orgs:', err);
      }
    };
    fetchOrgs();
  }, []);

  // Fetch flags
  useEffect(() => {
    const fetchFlags = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {};
        if (scopeFilter) params.scope = scopeFilter;

        const data = await apiFetch<FeatureFlag[]>('/studio/flags', { params });
        setFlags(data);
      } catch (err) {
        console.error('Failed to fetch flags:', err);
        if ((err as Error).message?.includes('403')) {
          setFlags([]);
        } else {
          toast.error('Failed to load feature flags');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchFlags();
  }, [scopeFilter, toast]);

  const handleToggle = async (flag: FeatureFlag) => {
    setTogglingId(flag.id);
    try {
      const updated = await apiFetch<FeatureFlag>(`/studio/flags/${flag.id}`, {
        method: 'PATCH',
        body: { enabled: !flag.enabled },
      });
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
      toast.success(`Flag "${flag.key}" ${updated.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Failed to toggle flag:', err);
      toast.error('Failed to toggle flag');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (newFlag: FeatureFlag) => {
    setFlags((prev) => [...prev, newFlag]);
    setShowNewModal(false);
    toast.success(`Flag "${newFlag.key}" created`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/studio" className="hover:text-blue-600">Studio</Link>
        <span>/</span>
        <span className="text-gray-900">Feature Flags</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚩 Feature Flags</h1>
          <p className="text-gray-600 mt-1">Control feature rollouts across your organization</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Flag
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scopes</option>
            <option value="GLOBAL">🌍 Global</option>
            <option value="ORG">🏢 Organization</option>
            <option value="PROJECT">📁 Project</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-500">
          {flags.length} flag{flags.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Flags List */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-500">Loading flags...</p>
        </div>
      ) : flags.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🚩</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No feature flags</h3>
          <p className="text-gray-600 mb-4">Create your first feature flag to control rollouts</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Flag
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-900">{flag.key}</span>
                    {flag.metadataJson && (flag.metadataJson as { description?: string }).description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {(flag.metadataJson as { description: string }).description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${SCOPE_COLORS[flag.scope]}`}>
                      {flag.scope === 'GLOBAL' && '🌍 '}
                      {flag.scope === 'ORG' && '🏢 '}
                      {flag.scope === 'PROJECT' && '📁 '}
                      {flag.scope}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(flag)}
                      disabled={togglingId === flag.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        flag.enabled ? 'bg-green-500' : 'bg-gray-300'
                      } ${togglingId === flag.id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`ml-2 text-sm ${flag.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(flag.key);
                        toast.success('Key copied to clipboard');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Copy Key
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Flag Modal */}
      {showNewModal && (
        <NewFlagModal
          orgs={orgs}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreate}
        />
      )}
    </div>
  );
}

// ============================================
// NEW FLAG MODAL
// ============================================

interface NewFlagModalProps {
  orgs: Org[];
  onClose: () => void;
  onCreated: (flag: FeatureFlag) => void;
}

function NewFlagModal({ orgs, onClose, onCreated }: NewFlagModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    key: string;
    enabled: boolean;
    scope: 'GLOBAL' | 'ORG' | 'PROJECT';
    orgId: string;
    projectId: string;
    description: string;
  }>({
    key: '',
    enabled: false,
    scope: 'GLOBAL',
    orgId: '',
    projectId: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key) {
      toast.error('Key is required');
      return;
    }

    if ((formData.scope === 'ORG' || formData.scope === 'PROJECT') && !formData.orgId) {
      toast.error('Organization is required for ORG/PROJECT scope');
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        key: formData.key,
        enabled: formData.enabled,
        scope: formData.scope,
      };

      if (formData.orgId) body.orgId = formData.orgId;
      if (formData.projectId) body.projectId = formData.projectId;
      if (formData.description) {
        body.metadataJson = { description: formData.description };
      }

      const newFlag = await apiFetch<FeatureFlag>('/studio/flags', {
        method: 'POST',
        body,
      });
      onCreated(newFlag);
    } catch (err) {
      console.error('Failed to create flag:', err);
      toast.error('Failed to create flag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">New Feature Flag</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
              placeholder="e.g., enable_new_dashboard"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Lowercase with underscores only</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this flag control?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as 'GLOBAL' | 'ORG' | 'PROJECT' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="GLOBAL">🌍 Global (all users)</option>
              <option value="ORG">🏢 Organization</option>
              <option value="PROJECT">📁 Project</option>
            </select>
          </div>

          {(formData.scope === 'ORG' || formData.scope === 'PROJECT') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.orgId}
                onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select organization...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Enable immediately
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Flag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// ICONS
// ============================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function FlagsPage() {
  return (
    <Protected>
      <AppShell>
        <FlagsContent />
      </AppShell>
    </Protected>
  );
}
