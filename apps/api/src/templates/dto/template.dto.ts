import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IssueSeverity } from '@prisma/client';

// ============================================
// Query Param DTOs
// ============================================

export class PaginationDto {
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

export class ListTemplatePagesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by URL or title' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by status code (e.g., 200, 301, 404)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: 'Filter pages with or without issues', enum: ['true', 'false'] })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  hasIssues?: boolean;
}

export class ListTemplateIssuesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by issue type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by severity', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: IssueSeverity;
}

// ============================================
// Response Interfaces
// ============================================

export interface SeverityCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface TopIssueType {
  type: string;
  count: number;
}

export interface TemplateListItem {
  templateId: string;
  name: string;
  pageCount: number;
  sampleUrl: string | null;
  issueCountTotal: number;
  severityCounts: SeverityCounts;
  topIssueTypes: TopIssueType[];
}

export interface TemplatesListResponse {
  items: TemplateListItem[];
  totalTemplates: number;
}

export interface TemplateDetailResponse {
  id: string;
  crawlRunId: string;
  name: string;
  pageCount: number;
  sampleUrl: string | null;
}

export interface TemplatePageItem {
  pageId: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number | null;
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
}

export interface TemplatePagesResponse {
  items: TemplatePageItem[];
  total: number;
}

export interface TemplateIssueItem {
  issueId: string;
  pageId: string | null;
  url: string | null;
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface TemplateIssuesResponse {
  items: TemplateIssueItem[];
  total: number;
}

// ============================================
// Swagger Response Classes
// ============================================

class SeverityCountsDto {
  @ApiProperty() LOW!: number;
  @ApiProperty() MEDIUM!: number;
  @ApiProperty() HIGH!: number;
  @ApiProperty() CRITICAL!: number;
}

class TopIssueTypeDto {
  @ApiProperty() type!: string;
  @ApiProperty() count!: number;
}

class TemplateListItemDto {
  @ApiProperty() templateId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() pageCount!: number;
  @ApiProperty({ nullable: true }) sampleUrl!: string | null;
  @ApiProperty() issueCountTotal!: number;
  @ApiProperty({ type: SeverityCountsDto }) severityCounts!: SeverityCountsDto;
  @ApiProperty({ type: [TopIssueTypeDto] }) topIssueTypes!: TopIssueTypeDto[];
}

export class TemplatesListResponseDto {
  @ApiProperty({ type: [TemplateListItemDto] }) items!: TemplateListItemDto[];
  @ApiProperty() totalTemplates!: number;
}

export class TemplateDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() crawlRunId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() pageCount!: number;
  @ApiProperty({ nullable: true }) sampleUrl!: string | null;
}

class TemplatePageItemDto {
  @ApiProperty() pageId!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ nullable: true }) statusCode!: number | null;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty({ nullable: true }) metaDescription!: string | null;
  @ApiProperty({ nullable: true }) h1Count!: number | null;
  @ApiProperty({ nullable: true }) canonical!: string | null;
  @ApiProperty({ nullable: true }) robotsMeta!: string | null;
  @ApiProperty({ nullable: true }) wordCount!: number | null;
}

export class TemplatePagesResponseDto {
  @ApiProperty({ type: [TemplatePageItemDto] }) items!: TemplatePageItemDto[];
  @ApiProperty() total!: number;
}

class TemplateIssueItemDto {
  @ApiProperty() issueId!: string;
  @ApiProperty({ nullable: true }) pageId!: string | null;
  @ApiProperty({ nullable: true }) url!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }) severity!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() recommendation!: string;
}

export class TemplateIssuesResponseDto {
  @ApiProperty({ type: [TemplateIssueItemDto] }) items!: TemplateIssueItemDto[];
  @ApiProperty() total!: number;
}
