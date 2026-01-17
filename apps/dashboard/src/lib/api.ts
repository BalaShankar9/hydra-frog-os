/**
 * API Client Wrapper - fetch wrapper with auth and error handling
 */

import { getToken, clearToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Custom API Error class with status code and response data
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Build URL with query parameters
 */
export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, API_BASE_URL);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Request options for apiFetch
 */
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Main API fetch wrapper
 * - Automatically includes Authorization header if token exists
 * - Parses JSON responses
 * - Provides helpful error messages
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, params, headers: customHeaders, ...restOptions } = options;
  
  const url = buildUrl(path, params);
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  
  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
  };
  
  // Add body if provided
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Try to parse JSON response
    let data: unknown;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorMessage = extractErrorMessage(data, response.status);
      
      // Auto-logout on 401 Unauthorized
      if (response.status === 401) {
        clearToken();
        // Redirect to login if we're in a browser context
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      
      throw new ApiError(errorMessage, response.status, data);
    }
    
    return data as T;
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to the API server', 0);
    }
    
    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      0
    );
  }
}

/**
 * Download a file from the API (handles auth header and blob download)
 * @param path - API endpoint path
 * @param filename - Name for the downloaded file
 */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const url = buildUrl(path);
  const token = getToken();

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Download failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = extractErrorMessage(errorData, response.status);
      } catch {
        // Ignore JSON parse errors
      }

      // Auto-logout on 401
      if (response.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new ApiError(errorMessage, response.status);
    }

    // Get the blob and create download link
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Download failed',
      0
    );
  }
}

/**
 * Extract a user-friendly error message from API response
 */
function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    
    // Handle NestJS validation errors (array of messages)
    if (Array.isArray(obj.message)) {
      return obj.message.join(', ');
    }
    
    // Handle single message
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    
    // Handle error field
    if (typeof obj.error === 'string') {
      return obj.error;
    }
  }
  
  // Default messages based on status code
  switch (status) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Unauthorized - Please log in';
    case 403:
      return 'Forbidden - You do not have permission';
    case 404:
      return 'Resource not found';
    case 500:
      return 'Internal server error';
    default:
      return `Request failed with status ${status}`;
  }
}

// ============================================
// API Endpoint Helpers
// ============================================

/**
 * Auth API endpoints
 */
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
    
  signup: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: { id: string; email: string } }>('/auth/signup', {
      method: 'POST',
      body: { email, password },
    }),
    
  me: () =>
    apiFetch<{ id: string; email: string; createdAt: string }>('/auth/me'),
};

/**
 * Projects API endpoints
 */
export const projectsApi = {
  list: (params?: { orgId?: string }) =>
    apiFetch<Array<{
      id: string;
      orgId: string;
      name: string;
      domain: string;
      startUrl: string;
      createdAt: string;
    }>>('/projects', { params }),
    
  get: (id: string) =>
    apiFetch<{
      id: string;
      orgId: string;
      name: string;
      domain: string;
      startUrl: string;
      settingsJson: Record<string, unknown>;
      createdAt: string;
    }>(`/projects/${id}`),
};

/**
 * Organizations API endpoints
 */
export const orgsApi = {
  list: () =>
    apiFetch<Array<{
      id: string;
      name: string;
      createdAt: string;
    }>>('/orgs'),
    
  create: (name: string) =>
    apiFetch<{ id: string; name: string }>('/orgs', {
      method: 'POST',
      body: { name },
    }),
};
