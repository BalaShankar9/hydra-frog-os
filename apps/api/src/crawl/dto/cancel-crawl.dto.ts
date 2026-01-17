import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelCrawlDto {
  @ApiProperty({
    example: 'crawl-run-id-123',
    description: 'Optional crawl run ID to cancel. If not provided, cancels the latest QUEUED/RUNNING run.',
    required: false,
  })
  @IsOptional()
  @IsString()
  crawlRunId?: string;
}
