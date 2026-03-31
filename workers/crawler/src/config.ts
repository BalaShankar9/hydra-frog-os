export interface WorkerConfig {
  concurrency: number;
  intervalMs: number;
  redisUrl: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export const config: WorkerConfig = {
  concurrency: parseInt(process.env.CRAWLER_CONCURRENCY || '5', 10),
  intervalMs: parseInt(process.env.CRAWLER_INTERVAL_MS || '5000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
};
