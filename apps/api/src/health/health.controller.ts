import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { ApiResponse } from '@hydra-frog-os/shared';
import { QueueService, QueueCounts } from '../queue';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
}

interface QueueHealthStatus {
  ok: boolean;
  counts: QueueCounts;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  @ApiOperation({ summary: 'Check API health' })
  @SwaggerResponse({ status: 200, description: 'API is healthy' })
  check(): ApiResponse<HealthStatus> {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    };
  }

  @Get('queue')
  @ApiOperation({ summary: 'Check queue health and counts' })
  @SwaggerResponse({ status: 200, description: 'Queue health status' })
  async checkQueue(): Promise<QueueHealthStatus> {
    const isHealthy = await this.queueService.isHealthy();
    const counts = await this.queueService.getCrawlQueueCounts();

    return {
      ok: isHealthy,
      counts,
    };
  }
}
