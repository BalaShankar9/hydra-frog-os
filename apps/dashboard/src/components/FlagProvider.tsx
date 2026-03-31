'use client';

/**
 * Feature Flag Context & Provider
 * 
 * Provides feature flag state to the entire app with:
 * - Automatic loading on mount
 * - Context-aware flag resolution (org, project)
 * - Local storage persistence for fast initial loads
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  FlagContextValue,
  fetchFlags,
  flagsToMap,
  loadPersistedFlags,
  persistFlags,
  loadPersistedContext,
  persistFlagContext,
} from '@/lib/flags';
import { isAuthed } from '@/lib/auth';

// ============================================
// CONTEXT
// ============================================

const FlagContext = createContext<FlagContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface FlagProviderProps {
  children: ReactNode;
  /** Initial org ID (optional) */
  initialOrgId?: string;
  /** Initial project ID (optional) */
  initialProjectId?: string;
}

export function FlagProvider({
  children,
  initialOrgId,
  initialProjectId,
}: FlagProviderProps) {
  // Load persisted state as initial values
  const persistedFlags = useMemo(() => loadPersistedFlags(), []);
  const persistedContext = useMemo(() => loadPersistedContext(), []);
  
  const [flags, setFlags] = useState<Record<string, boolean>>(persistedFlags);
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContextState] = useState({
    orgId: initialOrgId ?? persistedContext.orgId,
    projectId: initialProjectId ?? persistedContext.projectId,
  });

  // ============================================
  // REFRESH FLAGS
  // ============================================

  const refresh = useCallback(async (options?: { orgId?: string; projectId?: string }) => {
    // Only fetch if authenticated
    if (!isAuthed()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const flagsResponse = await fetchFlags({
        orgId: options?.orgId ?? context.orgId,
        projectId: options?.projectId ?? context.projectId,
      });
      
      const flagMap = flagsToMap(flagsResponse);
      setFlags(flagMap);
      persistFlags(flagMap);
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      // Keep using persisted/current flags on error
    } finally {
      setIsLoading(false);
    }
  }, [context.orgId, context.projectId]);

  // ============================================
  // SET CONTEXT
  // ============================================

  const setContext = useCallback((newContext: { orgId?: string; projectId?: string }) => {
    setContextState((prev) => {
      const updated = { ...prev, ...newContext };
      persistFlagContext(updated);
      return updated;
    });
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Fetch flags on mount and when context changes
  useEffect(() => {
    refresh();
  }, [context.orgId, context.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // IS ENABLED
  // ============================================

  const isEnabled = useCallback((key: string): boolean => {
    return flags[key] ?? false;
  }, [flags]);

  // ============================================
  // VALUE
  // ============================================

  const value = useMemo<FlagContextValue>(() => ({
    flags,
    isLoading,
    isEnabled,
    refresh,
    context,
    setContext,
  }), [flags, isLoading, isEnabled, refresh, context, setContext]);

  return (
    <FlagContext.Provider value={value}>
      {children}
    </FlagContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Get the full flag context
 */
export function useFlagContext(): FlagContextValue {
  const context = useContext(FlagContext);
  
  if (!context) {
    throw new Error('useFlagContext must be used within a FlagProvider');
  }
  
  return context;
}

/**
 * Check if a single flag is enabled
 * 
 * @example
 * const isEnabled = useFlag('tools.templatesV2');
 * if (isEnabled) { ... }
 */
export function useFlag(key: string): boolean {
  const { isEnabled } = useFlagContext();
  return isEnabled(key);
}

/**
 * Check multiple flags at once
 * 
 * @example
 * const flags = useFlags(['tools.templatesV2', 'tools.diffInsights']);
 * if (flags['tools.templatesV2']) { ... }
 */
export function useFlags(keys: string[]): Record<string, boolean> {
  const { flags } = useFlagContext();
  
  return useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = flags[key] ?? false;
    }
    return result;
  }, [flags, keys]);
}

/**
 * Hook for conditionally rendering based on a flag
 * Returns { enabled, loading } for more control
 * 
 * @example
 * const { enabled, loading } = useFlagState('tools.templatesV2');
 * if (loading) return <Spinner />;
 * if (!enabled) return null;
 */
export function useFlagState(key: string): { enabled: boolean; loading: boolean } {
  const { isEnabled, isLoading } = useFlagContext();
  
  return {
    enabled: isEnabled(key),
    loading: isLoading,
  };
}
