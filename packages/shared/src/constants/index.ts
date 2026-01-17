/**
 * Application name
 */
export const APP_NAME = 'hydra-frog-os';

/**
 * Default pagination values
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Redis key prefixes
 */
export const REDIS_KEYS = {
  SESSION: 'session:',
  CACHE: 'cache:',
  RATE_LIMIT: 'rate-limit:',
  JOB_QUEUE: 'job-queue:',
} as const;

/**
 * Queue names for workers
 */
export const QUEUE_NAMES = {
  CRAWLER: 'crawler-queue',
  EMAIL: 'email-queue',
  NOTIFICATIONS: 'notifications-queue',
} as const;

/**
 * Environment variable keys
 */
export const ENV_KEYS = {
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
  API_PORT: 'API_PORT',
  NODE_ENV: 'NODE_ENV',
} as const;
