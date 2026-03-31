import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { DiffType, DiffSeverity } from '@prisma/client';

// ============================================
// Query Param DTOs
// ============================================

export class ListDiffItemsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by diff type', enum: Object.values(DiffType) })
  @IsOptional()
  @IsString()
  type?: DiffType;

  @ApiPropertyOptional({ description: 'Filter by severity', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: DiffSeverity;

  @ApiPropertyOptional({ description: 'Filter by direction', enum: ['REGRESSION', 'IMPROVEMENT', 'NEUTRAL'] })
  @IsOptional()
  @IsIn(['REGRESSION', 'IMPROVEMENT', 'NEUTRAL'])
  direction?: 'REGRESSION' | 'IMPROVEMENT' | 'NEUTRAL';

  @ApiPropertyOptional({ description: 'Search by URL (contains)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;
}

export class CompareRunsDto {
  @ApiProperty({ description: 'From (previous) crawl run ID' })
  @IsString()
  fromRunId!: string;

  @ApiProperty({ description: 'To (current) crawl run ID' })
  @IsString()
  toRunId!: string;
}

// ============================================
// Response Interfaces
// ============================================

export interface DiffSummaryJson {
  totalItems: number;
  regressions: number;
  improvements: number;
  neutral: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topRegressions: Array<{
    normalizedUrl: string;
    type: string;
    severity: string;
  }>;
}

export interface DiffResponse {
  diffId: string;
  projectId: string;
  fromRunId: string;
  toRunId: string;
  createdAt: Date;
  summaryJson: DiffSummaryJson | null;
}

export interface DiffItemResponse {
  id: string;
  normalizedUrl: string;
  url: string;
  type: DiffType;
  severity: DiffSeverity;
  direction: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
}

export interface DiffItemsListResponse {
  items: DiffItemResponse[];
  total: number;
}

export interface CompareResponse {
  diffId: string;
  summaryJson: DiffSummaryJson | null;
  isNew: boolean;
}

// ============================================
// Swagger Response Classes
// ============================================

class DiffSummaryJsonDto {
  @ApiProperty() totalItems!: number;
  @ApiProperty() regressions!: number;
  @ApiProperty() improvements!: number;
  @ApiProperty() neutral!: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } }) byType!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } }) bySeverity!: Record<string, number>;
  @ApiProperty({ type: 'array' }) topRegressions!: Array<{ normalizedUrl: string; type: string; severity: string }>;
}

export class DiffResponseDto {
  @ApiProperty() diffId!: string;
  @ApiProperty() projectId!: string;
  @ApiProperty() fromRunId!: string;
  @ApiProperty() toRunId!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: DiffSummaryJsonDto, nullable: true }) summaryJson!: DiffSummaryJsonDto | null;
}

class DiffItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() normalizedUrl!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ enum: Object.values(DiffType) }) type!: DiffType;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }) severity!: DiffSeverity;
  @ApiProperty({ enum: ['REGRESSION', 'IMPROVEMENT', 'NEUTRAL'] }) direction!: string;
  @ApiProperty({ nullable: true }) beforeJson!: unknown;
  @ApiProperty({ nullable: true }) afterJson!: unknown;
  @ApiProperty() createdAt!: Date;
}

export class DiffItemsListResponseDto {
  @ApiProperty({ type: [DiffItemDto] }) items!: DiffItemDto[];
  @ApiProperty() total!: number;
}

export class CompareResponseDto {
  @ApiProperty() diffId!: string;
  @ApiProperty({ type: DiffSummaryJsonDto, nullable: true }) summaryJson!: DiffSummaryJsonDto | null;
  @ApiProperty({ description: 'Whether the diff was newly computed or already existed' }) isNew!: boolean;
}
