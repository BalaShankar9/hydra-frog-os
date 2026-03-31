import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly defaultTtl: number;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD') || undefined,
      keyPrefix: 'hf:cache:',
      maxRetriesPerRequest: 3,
    });
    this.defaultTtl = 300; // 5 minutes
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.set(key, serialized, 'EX', ttl ?? this.defaultTtl);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`hf:cache:${pattern}`);
    if (keys.length > 0) {
      // Remove the prefix since ioredis adds it automatically
      const unprefixed = keys.map((k) => k.replace('hf:cache:', ''));
      await this.redis.del(...unprefixed);
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
