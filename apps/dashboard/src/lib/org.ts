/**
 * Active Organization State - manages selected org in localStorage
 */

const ACTIVE_ORG_KEY = 'hydra_active_org';

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get the currently active organization ID
 */
export function getActiveOrgId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

/**
 * Set the active organization ID
 */
export function setActiveOrgId(orgId: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_ORG_KEY, orgId);
}

/**
 * Clear the active organization (on logout, etc.)
 */
export function clearActiveOrgId(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACTIVE_ORG_KEY);
}
