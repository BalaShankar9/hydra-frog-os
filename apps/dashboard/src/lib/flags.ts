/**
 * Feature Flags - lib/flags.ts
 * 
 * Client-side feature flag utilities
 */

// ============================================
// WELL-KNOWN FLAG KEYS
// ============================================

/**
 * Well-known feature flag keys (must match server-side FLAG_KEYS)
 */
export const FLAG_KEYS = {
  // Studio flags
  STUDIO_ENABLED: 'studio.enabled',
  
  // Tool flags
  TOOLS_TEMPLATES_V2: 'tools.templatesV2',
  TOOLS_DIFF_INSIGHTS: 'tools.diffInsights',
  TOOLS_PERFORMANCE: 'tools.performance',
  TOOLS_FIX_ENGINE: 'tools.fixEngine',
  TOOLS_SEO_HEALTH: 'tools.seoHealth',
  
  // Experimental features
  EXPERIMENTAL_AI_SUGGESTIONS: 'experimental.aiSuggestions',
  EXPERIMENTAL_BULK_FIXES: 'experimental.bulkFixes',
} as const;

export type FlagKey = typeof FLAG_KEYS[keyof typeof FLAG_KEYS];

// ============================================
// TYPES
// ============================================

export type FeatureFlagScope = 'GLOBAL' | 'ORG' | 'PROJECT';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  scope: FeatureFlagScope;
  orgId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FlagContextValue {
  /** Map of flag key -> enabled status */
  flags: Record<string, boolean>;
  
  /** Whether flags are currently loading */
  isLoading: boolean;
  
  /** Check if a flag is enabled */
  isEnabled: (key: string) => boolean;
  
  /** Refresh flags from server */
  refresh: (options?: { orgId?: string; projectId?: string }) => Promise<void>;
  
  /** Current org/project context for flag checks */
  context: { orgId?: string; projectId?: string };
  
  /** Update context (will trigger refresh) */
  setContext: (context: { orgId?: string; projectId?: string }) => void;
}

// ============================================
// LOCAL STORAGE
// ============================================

const FLAGS_STORAGE_KEY = 'hydra_feature_flags';
const FLAGS_CONTEXT_KEY = 'hydra_flags_context';

/**
 * Persist flags to localStorage
 */
export function persistFlags(flags: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load flags from localStorage
 */
export function loadPersistedFlags(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(FLAGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Persist flag context to localStorage
 */
export function persistFlagContext(context: { orgId?: string; projectId?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FLAGS_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load flag context from localStorage
 */
export function loadPersistedContext(): { orgId?: string; projectId?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(FLAGS_CONTEXT_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Clear persisted flags (on logout)
 */
export function clearPersistedFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FLAGS_STORAGE_KEY);
    localStorage.removeItem(FLAGS_CONTEXT_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// API HELPERS
// ============================================

import { apiFetch } from './api';

/**
 * Fetch enabled flags from the API
 */
export async function fetchFlags(options?: {
  orgId?: string;
  projectId?: string;
}): Promise<FeatureFlag[]> {
  const params: Record<string, string> = {};
  if (options?.orgId) params.orgId = options.orgId;
  if (options?.projectId) params.projectId = options.projectId;
  
  return apiFetch<FeatureFlag[]>('/flags', { params });
}

/**
 * Check specific flags
 */
export async function checkFlags(
  keys: string[],
  options?: { orgId?: string; projectId?: string }
): Promise<Record<string, boolean>> {
  return apiFetch<Record<string, boolean>>('/flags/check', {
    method: 'POST',
    body: {
      keys,
      orgId: options?.orgId,
      projectId: options?.projectId,
    },
  });
}

/**
 * Convert flag array to map
 */
export function flagsToMap(flags: FeatureFlag[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const flag of flags) {
    map[flag.key] = flag.enabled;
  }
  return map;
}
