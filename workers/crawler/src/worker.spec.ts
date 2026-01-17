import { CrawlerWorker } from './worker.js';
import type { CrawlerJob } from '@hydra-frog-os/shared';

describe('CrawlerWorker', () => {
  const config = {
    concurrency: 5,
    intervalMs: 1000,
    redisUrl: 'redis://localhost:6379',
  };

  it('should process a job successfully', async () => {
    const worker = new CrawlerWorker(config);

    const job: CrawlerJob = {
      id: 'test-job-1',
      url: 'https://example.com',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await worker.processJob(job);

    expect(result.status).toBe('completed');
    expect(result.result).toBeDefined();
  });
});
