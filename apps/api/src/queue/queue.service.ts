import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job, JobsOptions, RedisOptions } from 'bullmq';
import Redis from 'ioredis';

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private healthCheckConnection: Redis;
  private connectionConfig: RedisOptions;
  private queues: Map<string, Queue> = new Map();

  // Default queue name
  static readonly CRAWL_JOBS_QUEUE = 'crawl-jobs';

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    // Store config for BullMQ queues
    this.connectionConfig = {
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    // Separate connection for health checks
    this.healthCheckConnection = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    this.healthCheckConnection.on('error', (err) => {
      this.logger.error('Redis health check connection error:', err.message);
    });

    this.healthCheckConnection.on('connect', () => {
      this.logger.log(`Health check connected to Redis at ${host}:${port}`);
    });
  }

  async onModuleInit() {
    // Connect health check connection
    await this.healthCheckConnection.connect().catch(() => {
      this.logger.warn('Redis not available at startup - will retry on health checks');
    });

    // Initialize the default crawl-jobs queue
    this.getQueue(QueueService.CRAWL_JOBS_QUEUE);
    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.log(`Queue ${name} closed`);
    }

    // Close health check connection
    await this.healthCheckConnection.quit().catch(() => {});
    this.logger.log('Redis connections closed');
  }

  /**
   * Get or create a queue instance
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.connectionConfig,
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 1000, // Keep last 1000 failed jobs
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      this.queues.set(name, queue);
      this.logger.log(`Queue "${name}" created`);
    }

    return this.queues.get(name)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, opts);
    this.logger.debug(`Job ${job.id} added to queue "${queueName}"`);
    return job;
  }

  /**
   * Add a job to the crawl-jobs queue (convenience method)
   */
  async addCrawlJob<T>(jobName: string, data: T, opts?: JobsOptions): Promise<Job<T>> {
    return this.addJob(QueueService.CRAWL_JOBS_QUEUE, jobName, data, opts);
  }

  /**
   * Remove a job from a queue
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    this.logger.debug(`Job ${jobId} removed from queue "${queueName}"`);
    return true;
  }

  /**
   * Get the state of a job
   */
  async getJobState(
    queueName: string,
    jobId: string,
  ): Promise<string | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return job.getState();
  }

  /**
   * Get a job by ID
   */
  async getJob<T>(queueName: string, jobId: string): Promise<Job<T> | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job as Job<T> | null;
  }

  /**
   * Get queue counts (waiting, active, completed, failed, delayed)
   */
  async getQueueCounts(queueName: string): Promise<QueueCounts> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Get crawl-jobs queue counts (convenience method)
   */
  async getCrawlQueueCounts(): Promise<QueueCounts> {
    return this.getQueueCounts(QueueService.CRAWL_JOBS_QUEUE);
  }

  /**
   * Check if Redis is connected
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.healthCheckConnection.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get the Redis connection config (for workers)
   */
  getConnectionConfig(): RedisOptions {
    return this.connectionConfig;
  }
}
