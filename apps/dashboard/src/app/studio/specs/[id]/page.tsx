'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface StudioRequest {
  id: string;
  title: string;
  status: string;
  problem: string;
  desiredOutcome: string;
}

interface ToolSpec {
  id: string;
  orgId: string;
  requestId: string | null;
  name: string;
  version: string;
  description: string;
  status: string;
  blueprintJson: BlueprintJson;
  createdAt: string;
  updatedAt: string;
  request?: StudioRequest | null;
}

interface BlueprintJson {
  title?: string;
  problem?: string;
  desiredOutcome?: string;
  targetUsers?: string;
  inputs?: Array<{ name: string; type: string; description: string }>;
  outputs?: Array<{ name: string; type: string; description: string }>;
  steps?: Array<{ order: number; name: string; description: string }>;
  aiPrompts?: Record<string, string>;
  [key: string]: unknown;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  READY: 'bg-blue-100 text-blue-700 border-blue-300',
  SHIPPED: 'bg-green-100 text-green-700 border-green-300',
};

// ============================================
// MAIN CONTENT
// ============================================

function SpecDetailContent() {
  const params = useParams();
  const toast = useToast();
  const specId = params.id as string;

  const [spec, setSpec] = useState<ToolSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    description: '',
  });

  // Fetch spec
  useEffect(() => {
    const fetchSpec = async () => {
      try {
        const data = await apiFetch<ToolSpec>(`/studio/specs/${specId}`);
        setSpec(data);
        setEditForm({
          name: data.name,
          version: data.version,
          description: data.description,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load spec';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSpec();
  }, [specId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await apiFetch<ToolSpec>(`/studio/specs/${specId}`, {
        method: 'PATCH',
        body: editForm,
      });
      setSpec(updated);
      setIsEditing(false);
      toast.success('Spec updated successfully');
    } catch (err) {
      console.error('Failed to update spec:', err);
      toast.error('Failed to update spec');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsSaving(true);
    try {
      const updated = await apiFetch<ToolSpec>(`/studio/specs/${specId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setSpec(updated);
      toast.success(`Status changed to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link
          href="/studio"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Studio
        </Link>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">❓</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Spec Not Found</h2>
        <Link
          href="/studio"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Studio
        </Link>
      </div>
    );
  }

  const blueprint = spec.blueprintJson;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/studio" className="hover:text-blue-600">Studio</Link>
        <span>/</span>
        <span>Specs</span>
        <span>/</span>
        <span className="text-gray-900">{spec.name}</span>
      </nav>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          {isEditing ? (
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <input
                  type="text"
                  value={editForm.version}
                  onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      name: spec.name,
                      version: spec.version,
                      description: spec.description,
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{spec.name}</h1>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">v{spec.version}</span>
              </div>
              <p className="text-gray-600">{spec.description}</p>
              <p className="text-sm text-gray-500 mt-2">
                Updated {new Date(spec.updatedAt).toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[spec.status]}`}>
              {spec.status}
            </span>
            
            {/* Actions */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Status Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Change Status</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleStatusChange('DRAFT')}
              disabled={spec.status === 'DRAFT' || isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spec.status === 'DRAFT'
                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 Draft
            </button>
            <button
              onClick={() => handleStatusChange('READY')}
              disabled={spec.status === 'READY' || isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spec.status === 'READY'
                  ? 'bg-blue-200 text-blue-800 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              ✅ Ready
            </button>
            <button
              onClick={() => handleStatusChange('SHIPPED')}
              disabled={spec.status === 'SHIPPED' || isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                spec.status === 'SHIPPED'
                  ? 'bg-green-200 text-green-800 cursor-not-allowed'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              🚀 Shipped
            </button>
          </div>
        </div>

        {/* Link to Request */}
        {spec.request && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Original Request</h3>
            <Link
              href={`/studio/requests/${spec.request.id}`}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <span>📋</span>
              {spec.request.title}
            </Link>
          </div>
        )}
      </div>

      {/* Blueprint Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overview from Blueprint */}
        {(blueprint.title || blueprint.problem) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>📋</span> Overview
            </h3>
            {blueprint.title && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500">Title</h4>
                <p className="text-gray-900">{blueprint.title}</p>
              </div>
            )}
            {blueprint.problem && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500">Problem</h4>
                <p className="text-gray-700">{blueprint.problem}</p>
              </div>
            )}
            {blueprint.desiredOutcome && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500">Desired Outcome</h4>
                <p className="text-gray-700">{blueprint.desiredOutcome}</p>
              </div>
            )}
            {blueprint.targetUsers && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Target Users</h4>
                <p className="text-gray-700">{blueprint.targetUsers}</p>
              </div>
            )}
          </div>
        )}

        {/* Inputs */}
        {blueprint.inputs && blueprint.inputs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-blue-500">📥</span> Inputs
            </h3>
            <div className="space-y-3">
              {blueprint.inputs.map((input, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{input.name}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{input.type}</span>
                  </div>
                  <p className="text-sm text-gray-600">{input.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outputs */}
        {blueprint.outputs && blueprint.outputs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-green-500">📤</span> Outputs
            </h3>
            <div className="space-y-3">
              {blueprint.outputs.map((output, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{output.name}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{output.type}</span>
                  </div>
                  <p className="text-sm text-gray-600">{output.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {blueprint.steps && blueprint.steps.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-purple-500">📝</span> Steps
            </h3>
            <div className="space-y-4">
              {blueprint.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium">
                    {step.order || idx + 1}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{step.name}</h4>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Prompts */}
        {blueprint.aiPrompts && Object.keys(blueprint.aiPrompts).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-indigo-500">🤖</span> AI Prompts
            </h3>
            <div className="space-y-4">
              {Object.entries(blueprint.aiPrompts).map(([key, value]) => (
                <div key={key} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-mono text-sm font-medium text-indigo-600 mb-2">{key}</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{value}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Raw Blueprint JSON */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-gray-500">{ }</span> Raw Blueprint JSON
          </h3>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
              toast.success('Copied to clipboard');
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Copy JSON
          </button>
        </div>
        <pre className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
          {JSON.stringify(blueprint, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function SpecDetailPage() {
  return (
    <Protected>
      <AppShell>
        <SpecDetailContent />
      </AppShell>
    </Protected>
  );
}
