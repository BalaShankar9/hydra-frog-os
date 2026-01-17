export interface WorkerConfig {
  concurrency: number;
  intervalMs: number;
  redisUrl: string;
}

export const config: WorkerConfig = {
  concurrency: parseInt(process.env.CRAWLER_CONCURRENCY || '5', 10),
  intervalMs: parseInt(process.env.CRAWLER_INTERVAL_MS || '5000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
