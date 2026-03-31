'use client';

/**
 * Feature Flags Admin Page
 * 
 * Admin interface for managing feature flags
 */

import { useState, useEffect } from 'react';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { useFlagContext } from '@/components/FlagProvider';
import { FeatureFlag, FLAG_KEYS } from '@/lib/flags';

// ============================================
// TYPES
// ============================================

interface FlagWithId extends FeatureFlag {
  id?: string;
}

// ============================================
// MAIN PAGE
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

function FlagsContent() {
  const toast = useToast();
  const { refresh } = useFlagContext();
  
  const [flags, setFlags] = useState<FlagWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all flags
  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<FlagWithId[]>('/flags/all');
      setFlags(data);
    } catch (error) {
      toast.error('Failed to load flags');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  // Toggle a flag
  const handleToggle = async (flag: FlagWithId) => {
    try {
      await apiFetch('/flags/toggle', {
        method: 'POST',
        body: {
          key: flag.key,
          scope: flag.scope,
          orgId: flag.orgId ?? undefined,
          projectId: flag.projectId ?? undefined,
        },
      });
      toast.success(`Flag "${flag.key}" toggled`);
      await fetchFlags();
      await refresh(); // Refresh context flags
    } catch (error) {
      toast.error('Failed to toggle flag');
      console.error(error);
    }
  };

  // Delete a flag
  const handleDelete = async (flag: FlagWithId) => {
    if (!confirm(`Delete flag "${flag.key}" (${flag.scope})?`)) return;
    
    try {
      await apiFetch('/flags', {
        method: 'DELETE',
        body: {
          key: flag.key,
          scope: flag.scope,
          orgId: flag.orgId ?? undefined,
          projectId: flag.projectId ?? undefined,
        },
      });
      toast.success(`Flag "${flag.key}" deleted`);
      await fetchFlags();
      await refresh();
    } catch (error) {
      toast.error('Failed to delete flag');
      console.error(error);
    }
  };

  // Create a new flag
  const handleCreate = async (key: string, enabled: boolean) => {
    try {
      await apiFetch('/flags', {
        method: 'POST',
        body: {
          key,
          enabled,
          scope: 'GLOBAL',
        },
      });
      toast.success(`Flag "${key}" created`);
      setShowCreateModal(false);
      await fetchFlags();
      await refresh();
    } catch (error) {
      toast.error('Failed to create flag');
      console.error(error);
    }
  };

  // Group flags by prefix
  const groupedFlags = flags.reduce((acc, flag) => {
    const prefix = flag.key.split('.')[0] || 'other';
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(flag);
    return acc;
  }, {} as Record<string, FlagWithId[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage feature flags for safe rollout and A/B testing
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Flag
        </button>
      </div>

      {/* Flags Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFlags).map(([prefix, prefixFlags]) => (
            <div key={prefix} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 capitalize">{prefix}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {prefixFlags.map((flag, idx) => (
                  <FlagRow
                    key={`${flag.key}-${flag.scope}-${idx}`}
                    flag={flag}
                    onToggle={() => handleToggle(flag)}
                    onDelete={() => handleDelete(flag)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Well-known flags reference */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Well-Known Flag Keys</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Object.entries(FLAG_KEYS).map(([name, key]) => (
            <div key={key} className="flex items-center gap-2">
              <code className="text-xs bg-gray-200 px-1 rounded">{key}</code>
              <span className="text-gray-500">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateFlagModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// ============================================
// FLAG ROW
// ============================================

interface FlagRowProps {
  flag: FlagWithId;
  onToggle: () => void;
  onDelete: () => void;
}

function FlagRow({ flag, onToggle, onDelete }: FlagRowProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <code className="text-sm font-medium text-gray-900">{flag.key}</code>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              flag.scope === 'GLOBAL'
                ? 'bg-purple-100 text-purple-700'
                : flag.scope === 'ORG'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {flag.scope}
          </span>
        </div>
        {(flag.orgId || flag.projectId) && (
          <div className="text-xs text-gray-500 mt-1">
            {flag.orgId && <span>Org: {flag.orgId}</span>}
            {flag.projectId && <span className="ml-2">Project: {flag.projectId}</span>}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            flag.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              flag.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        
        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// CREATE MODAL
// ============================================

interface CreateFlagModalProps {
  onClose: () => void;
  onCreate: (key: string, enabled: boolean) => void;
}

function CreateFlagModal({ onClose, onCreate }: CreateFlagModalProps) {
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    onCreate(key.trim(), enabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Create Feature Flag</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flag Key
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., tools.newFeature"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Enable immediately
            </label>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!key.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Create
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
