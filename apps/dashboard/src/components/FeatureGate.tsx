'use client';

/**
 * FeatureGate Component
 * 
 * Conditionally render children based on feature flag status.
 * Great for hiding/showing UI sections based on flags.
 * 
 * @example
 * <FeatureGate flag="tools.templatesV2">
 *   <TemplatesV2Tab />
 * </FeatureGate>
 * 
 * @example
 * // With fallback
 * <FeatureGate flag="tools.performance" fallback={<LegacyPerf />}>
 *   <NewPerfDashboard />
 * </FeatureGate>
 * 
 * @example
 * // Inverted (show when disabled)
 * <FeatureGate flag="tools.v2" invert>
 *   <LegacyWarningBanner />
 * </FeatureGate>
 */

import { ReactNode } from 'react';
import { useFlag, useFlagState } from './FlagProvider';

// ============================================
// TYPES
// ============================================

interface FeatureGateProps {
  /** The flag key to check */
  flag: string;
  
  /** Content to show when flag is enabled (or disabled if invert=true) */
  children: ReactNode;
  
  /** Content to show when flag is disabled (or enabled if invert=true) */
  fallback?: ReactNode;
  
  /** If true, show children when flag is DISABLED */
  invert?: boolean;
  
  /** If true, show a loading indicator while flags are loading */
  showLoading?: boolean;
  
  /** Custom loading component */
  loadingComponent?: ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function FeatureGate({
  flag,
  children,
  fallback = null,
  invert = false,
  showLoading = false,
  loadingComponent,
}: FeatureGateProps) {
  const { enabled, loading } = useFlagState(flag);
  
  // Show loading state if requested
  if (loading && showLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className="animate-pulse h-4 w-24 bg-gray-200 rounded" />
    );
  }
  
  // Determine what to render
  const shouldShow = invert ? !enabled : enabled;
  
  return <>{shouldShow ? children : fallback}</>;
}

// ============================================
// UTILITY COMPONENTS
// ============================================

interface FlaggedNavItemProps {
  flag: string;
  name: string;
  href: string;
  icon?: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Navigation item that only shows when a flag is enabled
 */
export function FlaggedNavItem({
  flag,
  name,
  href,
  icon,
  isActive,
  onClick,
}: FlaggedNavItemProps) {
  const enabled = useFlag(flag);
  
  if (!enabled) return null;
  
  return (
    <a
      href={href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      {icon}
      {name}
    </a>
  );
}

interface FlaggedTabProps {
  flag: string;
  label: string;
  value: string;
  isActive?: boolean;
  onClick?: (value: string) => void;
}

/**
 * Tab button that only shows when a flag is enabled
 */
export function FlaggedTab({
  flag,
  label,
  value,
  isActive,
  onClick,
}: FlaggedTabProps) {
  const enabled = useFlag(flag);
  
  if (!enabled) return null;
  
  return (
    <button
      onClick={() => onClick?.(value)}
      className={`
        px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
        ${isActive
          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }
      `}
    >
      {label}
    </button>
  );
}

interface FlaggedButtonProps {
  flag: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Button that only shows when a flag is enabled
 */
export function FlaggedButton({
  flag,
  children,
  onClick,
  className = '',
  disabled,
}: FlaggedButtonProps) {
  const enabled = useFlag(flag);
  
  if (!enabled) return null;
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

// ============================================
// HOC (Higher-Order Component)
// ============================================

/**
 * Higher-order component that wraps a component with a feature gate
 * 
 * @example
 * const GatedTemplatesV2 = withFeatureGate('tools.templatesV2')(TemplatesV2Page);
 */
export function withFeatureGate<P extends object>(
  flag: string,
  fallback: ReactNode = null
) {
  return function WithFeatureGate(Component: React.ComponentType<P>) {
    return function FeatureGatedComponent(props: P) {
      const enabled = useFlag(flag);
      
      if (!enabled) {
        return <>{fallback}</>;
      }
      
      return <Component {...props} />;
    };
  };
}

// ============================================
// RENDER PROP COMPONENT
// ============================================

interface FeatureFlagRenderProps {
  flag: string;
  children: (props: { enabled: boolean; loading: boolean }) => ReactNode;
}

/**
 * Render prop component for more complex conditional rendering
 * 
 * @example
 * <FeatureFlagRender flag="tools.templatesV2">
 *   {({ enabled, loading }) => (
 *     loading ? <Spinner /> : enabled ? <NewUI /> : <OldUI />
 *   )}
 * </FeatureFlagRender>
 */
export function FeatureFlagRender({ flag, children }: FeatureFlagRenderProps) {
  const state = useFlagState(flag);
  return <>{children(state)}</>;
}
