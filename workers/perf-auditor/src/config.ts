/**
 * Configuration for perf-auditor worker
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10),
    lighthouseTimeoutMs: parseInt(process.env.LIGHTHOUSE_TIMEOUT_MS || '60000', 10),
    defaultDevice: (process.env.LIGHTHOUSE_DEVICE || 'MOBILE') as 'MOBILE' | 'DESKTOP',
  },
  storage: {
    basePath: process.env.STORAGE_PATH || join(__dirname, '../../../storage/lighthouse'),
  },
};
