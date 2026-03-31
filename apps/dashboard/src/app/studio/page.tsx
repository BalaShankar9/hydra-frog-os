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

interface StudioRequest {
  id: string;
  orgId: string;
  createdById: string | null;
  title: string;
  problem: string;
  desiredOutcome: string;
  targetUsers: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'IDEA' | 'REVIEW' | 'APPROVED' | 'BUILDING' | 'QA' | 'SHIPPED' | 'REJECTED';
  approvedSpecId: string | null;
  createdAt: string;
  updatedAt: string;
  toolSpecs?: Array<{ id: string; name: string; status: string }>;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_COLORS: Record<string, string> = {
  IDEA: 'bg-gray-100 text-gray-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  BUILDING: 'bg-blue-100 text-blue-800',
  QA: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
};

const PRIORITY_ICONS: Record<string, string> = {
  LOW: '○',
  MEDIUM: '◐',
  HIGH: '●',
  URGENT: '🔥',
};

// ============================================
// MAIN PAGE
// ============================================

function StudioContent() {
  const toast = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [requests, setRequests] = useState<StudioRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch orgs
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await apiFetch<Org[]>('/orgs');
        setOrgs(data);
        // Select first admin org
        const adminOrg = data.find((o) => o.role === 'ADMIN');
        if (adminOrg) {
          setSelectedOrgId(adminOrg.id);
          setIsAdmin(true);
        } else if (data.length > 0) {
          setSelectedOrgId(data[0].id);
          setIsAdmin(data[0].role === 'ADMIN');
        }
      } catch (err) {
        console.error('Failed to fetch orgs:', err);
        toast.error('Failed to load organizations');
      }
    };
    fetchOrgs();
  }, [toast]);

  // Fetch requests when org changes
  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {};
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;

        const data = await apiFetch<StudioRequest[]>(
          `/studio/orgs/${selectedOrgId}/requests`,
          { params }
        );
        setRequests(data);
      } catch (err) {
        console.error('Failed to fetch requests:', err);
        if ((err as Error).message?.includes('403')) {
          setIsAdmin(false);
        } else {
          toast.error('Failed to load requests');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequests();
  }, [selectedOrgId, statusFilter, priorityFilter, toast]);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    const org = orgs.find((o) => o.id === orgId);
    setIsAdmin(org?.role === 'ADMIN');
  };

  if (!isAdmin && !isLoading) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
        <p className="text-gray-600 mb-6">
          You need to be an organization admin to access the Marketing Experience Studio.
        </p>
        <Link
          href="/projects"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">✨ Marketing Experience Studio</h1>
          <p className="text-gray-600 mt-1">Create and manage marketing tools and experiences</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        {/* Org selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Organization</label>
          <select
            value={selectedOrgId}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {orgs.filter((o) => o.role === 'ADMIN').map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="IDEA">💡 Idea</option>
            <option value="REVIEW">👀 Review</option>
            <option value="APPROVED">✅ Approved</option>
            <option value="BUILDING">🔨 Building</option>
            <option value="QA">🧪 QA</option>
            <option value="SHIPPED">🚀 Shipped</option>
            <option value="REJECTED">❌ Rejected</option>
          </select>
        </div>

        {/* Priority filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">🔥 Urgent</option>
          </select>
        </div>

        {/* Quick links */}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/studio/flags"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <FlagIcon className="w-4 h-4" />
            Feature Flags
          </Link>
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-500">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests yet</h3>
          <p className="text-gray-600 mb-4">Create your first marketing experience request</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Request
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tool Spec</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/studio/requests/${request.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {request.title}
                    </Link>
                    <p className="text-sm text-gray-500 truncate max-w-md">{request.problem}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[request.status]}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${PRIORITY_COLORS[request.priority]}`}>
                      {PRIORITY_ICONS[request.priority]} {request.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {request.toolSpecs && request.toolSpecs.length > 0 ? (
                      <Link
                        href={`/studio/specs/${request.toolSpecs[0].id}`}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {request.toolSpecs[0].name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/studio/requests/${request.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Request Modal */}
      {showNewModal && (
        <NewRequestModal
          orgId={selectedOrgId}
          onClose={() => setShowNewModal(false)}
          onCreated={(newRequest) => {
            setRequests((prev) => [newRequest, ...prev]);
            setShowNewModal(false);
            toast.success('Request created successfully');
          }}
        />
      )}
    </div>
  );
}

// ============================================
// NEW REQUEST MODAL
// ============================================

interface NewRequestModalProps {
  orgId: string;
  onClose: () => void;
  onCreated: (request: StudioRequest) => void;
}

function NewRequestModal({ orgId, onClose, onCreated }: NewRequestModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    problem: string;
    desiredOutcome: string;
    targetUsers: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }>({
    title: '',
    problem: '',
    desiredOutcome: '',
    targetUsers: '',
    priority: 'MEDIUM',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.problem || !formData.desiredOutcome) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const newRequest = await apiFetch<StudioRequest>(`/studio/orgs/${orgId}/requests`, {
        method: 'POST',
        body: formData,
      });
      onCreated(newRequest);
    } catch (err) {
      console.error('Failed to create request:', err);
      toast.error('Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">New Marketing Experience Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Interactive ROI Calculator"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Problem Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="What problem are we solving? What pain point exists?"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desired Outcome <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.desiredOutcome}
              onChange={(e) => setFormData({ ...formData, desiredOutcome: e.target.value })}
              placeholder="What should users be able to do? What's the expected result?"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Users</label>
            <input
              type="text"
              value={formData.targetUsers}
              onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value })}
              placeholder="e.g., Marketing managers, Enterprise customers"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">🔥 Urgent</option>
            </select>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Creating...
                </>
              ) : (
                'Create Request'
              )}
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

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
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

export default function StudioPage() {
  return (
    <Protected>
      <AppShell>
        <StudioContent />
      </AppShell>
    </Protected>
  );
}
