'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface ToolSpec {
  id: string;
  name: string;
  version: string;
  description: string;
  status: string;
  blueprintJson: Record<string, unknown>;
  createdAt: string;
}

interface AiSuggestions {
  suggestedToolName: string;
  category: string;
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  dataSources: Array<{
    type: string;
    reason: string;
    required: boolean;
    suggestedFields: string[];
  }>;
  screens: Array<{
    type: string;
    title: string;
    components: string[];
    reason: string;
  }>;
  inputs: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  kpis: Array<{
    id: string;
    name: string;
    calculation: string;
    dataSource: string;
    unit?: string;
    target?: number;
    thresholds?: Record<string, unknown>;
  }>;
  exports: Array<{
    type: string;
    name: string;
    template?: string;
    fields?: string[];
  }>;
  risks: Array<{
    id: string;
    description: string;
    severity: string;
    likelihood: string;
    category: string;
    mitigation: string;
  }>;
  estimatedComplexity: number;
  estimatedHours: number;
  tags: string[];
  confidence: number;
  generatedAt: string;
  generatorVersion: string;
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
  notesJson: Record<string, unknown> | null;
  aiSuggestionsJson: AiSuggestions | null;
  approvedSpecId: string | null;
  createdAt: string;
  updatedAt: string;
  toolSpecs?: ToolSpec[];
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_COLORS: Record<string, string> = {
  IDEA: 'bg-gray-100 text-gray-800 border-gray-300',
  REVIEW: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVED: 'bg-green-100 text-green-800 border-green-300',
  BUILDING: 'bg-blue-100 text-blue-800 border-blue-300',
  QA: 'bg-purple-100 text-purple-800 border-purple-300',
  SHIPPED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_FLOW = ['IDEA', 'REVIEW', 'APPROVED', 'BUILDING', 'QA', 'SHIPPED'];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500 bg-gray-50 border-gray-200',
  MEDIUM: 'text-blue-600 bg-blue-50 border-blue-200',
  HIGH: 'text-orange-600 bg-orange-50 border-orange-200',
  URGENT: 'text-red-600 bg-red-50 border-red-200',
};

// ============================================
// MAIN CONTENT
// ============================================

function RequestDetailContent() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const requestId = params.id as string;

  const [request, setRequest] = useState<StudioRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Fetch request
  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const data = await apiFetch<StudioRequest>(`/studio/requests/${requestId}`);
        setRequest(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load request';
        setError(message);
        if (message.includes('403')) {
          setError('You do not have permission to view this request');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequest();
  }, [requestId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!request) return;
    setIsUpdating(true);
    try {
      const updated = await apiFetch<StudioRequest>(`/studio/requests/${requestId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setRequest(updated);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    setIsUpdating(true);
    try {
      const result = await apiFetch<{ request: StudioRequest; toolSpec: ToolSpec }>(
        `/studio/requests/${requestId}/approve`,
        { method: 'POST' }
      );
      setRequest(result.request);
      toast.success('Request approved! Tool spec created.');
      // Navigate to the new spec
      router.push(`/studio/specs/${result.toolSpec.id}`);
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error('Failed to approve request');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!request) return;
    setIsUpdating(true);
    try {
      const updated = await apiFetch<StudioRequest>(`/studio/requests/${requestId}/reject`, {
        method: 'POST',
      });
      // Also save the rejection reason in notes
      if (reason) {
        await apiFetch(`/studio/requests/${requestId}`, {
          method: 'PATCH',
          body: { notesJson: { ...request.notesJson, rejectionReason: reason } },
        });
      }
      setRequest({ ...updated, notesJson: { ...request.notesJson, rejectionReason: reason } });
      setShowRejectModal(false);
      toast.success('Request rejected');
    } catch (err) {
      console.error('Failed to reject:', err);
      toast.error('Failed to reject request');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!request) return;
    setIsGeneratingSuggestions(true);
    try {
      const suggestions = await apiFetch<AiSuggestions>(
        `/studio/requests/${requestId}/suggest`,
        { method: 'POST' }
      );
      setRequest({ ...request, aiSuggestionsJson: suggestions });
      toast.success('AI suggestions generated!');
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
      toast.error('Failed to generate suggestions');
    } finally {
      setIsGeneratingSuggestions(false);
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

  if (!request) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">❓</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Not Found</h2>
        <Link
          href="/studio"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Studio
        </Link>
      </div>
    );
  }

  const canApprove = ['IDEA', 'REVIEW'].includes(request.status);
  const canReject = !['REJECTED', 'SHIPPED'].includes(request.status);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/studio" className="hover:text-blue-600">Studio</Link>
        <span>/</span>
        <span className="text-gray-900">{request.title}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
            <p className="text-gray-500 mt-1">
              Created {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[request.status]}`}>
              {request.status}
            </span>
            <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${PRIORITY_COLORS[request.priority]}`}>
              {request.priority === 'URGENT' ? '🔥 ' : ''}{request.priority}
            </span>
          </div>
        </div>

        {/* Status Pipeline */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Pipeline</h3>
          <div className="flex items-center gap-2">
            {STATUS_FLOW.map((status, idx) => {
              const isActive = request.status === status;
              const isPast = STATUS_FLOW.indexOf(request.status) > idx;
              const isRejected = request.status === 'REJECTED';
              
              return (
                <div key={status} className="flex items-center">
                  <button
                    onClick={() => !isRejected && handleStatusChange(status)}
                    disabled={isUpdating || isRejected}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isPast
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } ${isRejected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {status}
                  </button>
                  {idx < STATUS_FLOW.length - 1 && (
                    <ChevronRightIcon className={`w-4 h-4 mx-1 ${isPast ? 'text-green-400' : 'text-gray-300'}`} />
                  )}
                </div>
              );
            })}
            {request.status === 'REJECTED' && (
              <span className="ml-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700">
                ❌ REJECTED
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200 flex items-center gap-3">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={isUpdating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckIcon className="w-5 h-5" />
              Approve & Create Spec
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isUpdating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <XIcon className="w-5 h-5" />
              Reject
            </button>
          )}
          {request.toolSpecs && request.toolSpecs.length > 0 && (
            <Link
              href={`/studio/specs/${request.toolSpecs[0].id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <DocumentIcon className="w-5 h-5" />
              View Tool Spec
            </Link>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problem Statement */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">⚠️</span> Problem Statement
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{request.problem}</p>
        </div>

        {/* Desired Outcome */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-green-500">🎯</span> Desired Outcome
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{request.desiredOutcome}</p>
        </div>

        {/* Target Users */}
        {request.targetUsers && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-blue-500">👥</span> Target Users
            </h3>
            <p className="text-gray-700">{request.targetUsers}</p>
          </div>
        )}

        {/* Notes/Rejection Reason */}
        {request.notesJson && Object.keys(request.notesJson).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-yellow-500">📝</span> Notes
            </h3>
            {(request.notesJson as { rejectionReason?: string }).rejectionReason && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 mb-3">
                <p className="text-sm font-medium text-red-700">Rejection Reason:</p>
                <p className="text-red-600">{(request.notesJson as { rejectionReason: string }).rejectionReason}</p>
              </div>
            )}
            <pre className="text-sm text-gray-600 overflow-auto">
              {JSON.stringify(request.notesJson, null, 2)}
            </pre>
          </div>
        )}

        {/* AI Suggestions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-purple-500">🤖</span> AI Suggestions
            </h3>
            <button
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isGeneratingSuggestions ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  {request.aiSuggestionsJson ? 'Regenerate' : 'Generate'} Suggestions
                </>
              )}
            </button>
          </div>
          
          {request.aiSuggestionsJson ? (
            <AiSuggestionsDisplay suggestions={request.aiSuggestionsJson} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No AI suggestions generated yet.</p>
              <p className="text-sm">Click the button above to analyze this request and generate feature suggestions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tool Specs */}
      {request.toolSpecs && request.toolSpecs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Tool Specs</h3>
          <div className="space-y-3">
            {request.toolSpecs.map((spec) => (
              <Link
                key={spec.id}
                href={`/studio/specs/${spec.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{spec.name}</h4>
                  <p className="text-sm text-gray-500">v{spec.version}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  spec.status === 'SHIPPED' ? 'bg-green-100 text-green-700' :
                  spec.status === 'READY' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {spec.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <RejectModal
          onClose={() => setShowRejectModal(false)}
          onReject={handleReject}
          isSubmitting={isUpdating}
        />
      )}
    </div>
  );
}

// ============================================
// AI SUGGESTIONS DISPLAY
// ============================================

interface AiSuggestionsDisplayProps {
  suggestions: AiSuggestions;
}

function AiSuggestionsDisplay({ suggestions }: AiSuggestionsDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const complexityStars = '★'.repeat(suggestions.estimatedComplexity) + '☆'.repeat(5 - suggestions.estimatedComplexity);
  
  return (
    <div className="space-y-4">
      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-xs text-purple-600 font-medium">Suggested Name</p>
          <p className="font-semibold text-gray-900 truncate">{suggestions.suggestedToolName}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium">Category</p>
          <p className="font-semibold text-gray-900">{suggestions.category}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-xs text-orange-600 font-medium">Complexity</p>
          <p className="font-semibold text-orange-500">{complexityStars}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-green-600 font-medium">Est. Hours</p>
          <p className="font-semibold text-gray-900">{suggestions.estimatedHours}h</p>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Confidence</span>
          <span className="text-xs font-medium text-gray-900">{suggestions.confidence}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple-500 rounded-full" 
            style={{ width: `${suggestions.confidence}%` }} 
          />
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {suggestions.tags.map((tag) => (
          <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            #{tag}
          </span>
        ))}
      </div>

      {/* Expandable Sections */}
      <div className="space-y-2 mt-4">
        {/* Features */}
        <CollapsibleSection
          title="📋 Features"
          isExpanded={expandedSection === 'features'}
          onToggle={() => toggleSection('features')}
          count={suggestions.mustHaveFeatures.length + suggestions.niceToHaveFeatures.length}
        >
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Must Have</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.mustHaveFeatures.map((f) => (
                  <span key={f} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>
            {suggestions.niceToHaveFeatures.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nice to Have</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.niceToHaveFeatures.map((f) => (
                    <span key={f} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Data Sources */}
        <CollapsibleSection
          title="📊 Data Sources"
          isExpanded={expandedSection === 'dataSources'}
          onToggle={() => toggleSection('dataSources')}
          count={suggestions.dataSources.length}
        >
          <div className="space-y-2">
            {suggestions.dataSources.map((ds) => (
              <div key={ds.type} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{ds.type}</span>
                  {ds.required && (
                    <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">Required</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{ds.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {ds.suggestedFields.map((field) => (
                    <code key={field} className="px-1.5 py-0.5 text-xs bg-white border rounded">
                      {field}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Screens */}
        <CollapsibleSection
          title="🖥️ UI Screens"
          isExpanded={expandedSection === 'screens'}
          onToggle={() => toggleSection('screens')}
          count={suggestions.screens.length}
        >
          <div className="space-y-2">
            {suggestions.screens.map((screen, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{screen.title}</span>
                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">{screen.type}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{screen.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {screen.components.map((comp) => (
                    <span key={comp} className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* KPIs */}
        <CollapsibleSection
          title="📈 KPIs"
          isExpanded={expandedSection === 'kpis'}
          onToggle={() => toggleSection('kpis')}
          count={suggestions.kpis.length}
        >
          <div className="space-y-2">
            {suggestions.kpis.map((kpi) => (
              <div key={kpi.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{kpi.name}</span>
                  {kpi.unit && <span className="text-xs text-gray-500">{kpi.unit}</span>}
                </div>
                <code className="text-xs text-gray-600 bg-white p-1 rounded block">
                  {kpi.calculation}
                </code>
                {kpi.target && (
                  <p className="text-xs text-green-600 mt-1">Target: {kpi.target}{kpi.unit}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Risks */}
        <CollapsibleSection
          title="⚠️ Risks"
          isExpanded={expandedSection === 'risks'}
          onToggle={() => toggleSection('risks')}
          count={suggestions.risks.length}
        >
          <div className="space-y-2">
            {suggestions.risks.map((risk) => (
              <div key={risk.id} className="p-3 bg-gray-50 rounded-lg border-l-4 border-orange-400">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{risk.description}</span>
                </div>
                <div className="flex gap-2 text-xs mb-2">
                  <span className={`px-1.5 py-0.5 rounded ${
                    risk.severity === 'HIGH' ? 'bg-red-100 text-red-600' :
                    risk.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {risk.severity}
                  </span>
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {risk.likelihood}
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                    {risk.category}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Mitigation:</span> {risk.mitigation}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Exports */}
        <CollapsibleSection
          title="📤 Export Formats"
          isExpanded={expandedSection === 'exports'}
          onToggle={() => toggleSection('exports')}
          count={suggestions.exports.length}
        >
          <div className="flex flex-wrap gap-2">
            {suggestions.exports.map((exp) => (
              <span key={exp.type} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm">
                {exp.type === 'CSV' ? '📄' : exp.type === 'PDF' ? '📕' : exp.type === 'JSON' ? '🔧' : '📊'} {exp.name}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Generation Info */}
      <div className="text-xs text-gray-400 text-right pt-2 border-t border-gray-100">
        Generated at {new Date(suggestions.generatedAt).toLocaleString()} · v{suggestions.generatorVersion}
      </div>
    </div>
  );
}

// ============================================
// COLLAPSIBLE SECTION
// ============================================

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isExpanded, onToggle, count, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900 flex items-center gap-2">
          {title}
          <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
            {count}
          </span>
        </span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className="px-4 py-3 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// REJECT MODAL
// ============================================

interface RejectModalProps {
  onClose: () => void;
  onReject: (reason: string) => void;
  isSubmitting: boolean;
}

function RejectModal({ onClose, onReject, isSubmitting }: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Reject Request</h2>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rejection Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this request being rejected?"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onReject(reason)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Rejecting...' : 'Reject Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ICONS
// ============================================

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function RequestDetailPage() {
  return (
    <Protected>
      <AppShell>
        <RequestDetailContent />
      </AppShell>
    </Protected>
  );
}
