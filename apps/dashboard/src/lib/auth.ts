/**
 * Auth Store - manages authentication token in localStorage
 */

const TOKEN_KEY = 'hydra_token';

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get the current authentication token
 */
export function getToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the authentication token
 */
export function setToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear the authentication token (logout)
 */
export function clearToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if the user is authenticated
 */
export function isAuthed(): boolean {
  return !!getToken();
}
