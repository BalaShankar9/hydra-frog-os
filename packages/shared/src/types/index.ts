/**
 * Common user type
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination request params
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Job status for workers
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Crawler job definition
 */
export interface CrawlerJob {
  id: string;
  url: string;
  status: JobStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
