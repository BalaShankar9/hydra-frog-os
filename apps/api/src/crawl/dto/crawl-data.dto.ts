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

export class ListPagesQueryDto extends PaginationDto {
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

export class ListIssuesQueryDto extends PaginationDto {
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
// Response Interfaces (for documentation)
// ============================================

export interface PageItem {
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

export interface PagesListResponse {
  items: PageItem[];
  total: number;
}

export interface IssueItem {
  issueId: string;
  pageId: string | null;
  url: string | null;
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  evidenceJson?: unknown;
}

export interface IssuesListResponse {
  items: IssueItem[];
  total: number;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface IssuesSummaryResponse {
  byType: TypeCount[];
  bySeverity: SeverityCount[];
  total: number;
}

export interface RedirectItem {
  pageId: string;
  url: string;
  statusCode: number;
  redirectChainJson: unknown;
}

export interface RedirectsListResponse {
  items: RedirectItem[];
  total: number;
}

export interface BrokenLinkItem {
  linkId: string;
  fromPageUrl: string | null;
  toUrl: string;
  statusCode: number | null;
}

export interface BrokenLinksListResponse {
  items: BrokenLinkItem[];
  total: number;
}

export interface LinkItem {
  linkId: string;
  toUrl: string;
  linkType: string;
  isBroken: boolean;
  statusCode: number | null;
}

export interface InlinkItem {
  linkId: string;
  fromPageId: string | null;
  fromUrl: string | null;
}

export interface PageDetailsResponse {
  pageId: string;
  url: string;
  normalizedUrl: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number | null;
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
  htmlHash: string | null;
  redirectChainJson: unknown;
  discoveredAt: Date;
  issues: IssueItem[];
  outgoingLinks: LinkItem[];
  inlinks: InlinkItem[];
}

// ============================================
// Swagger Response Classes (for @ApiResponse type)
// ============================================

class PageItemDto {
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

export class PagesListResponseDto {
  @ApiProperty({ type: [PageItemDto] }) items!: PageItemDto[];
  @ApiProperty() total!: number;
}

class IssueItemDto {
  @ApiProperty() issueId!: string;
  @ApiProperty({ nullable: true }) pageId!: string | null;
  @ApiProperty({ nullable: true }) url!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }) severity!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() recommendation!: string;
}

export class IssuesListResponseDto {
  @ApiProperty({ type: [IssueItemDto] }) items!: IssueItemDto[];
  @ApiProperty() total!: number;
}

class TypeCountDto {
  @ApiProperty() type!: string;
  @ApiProperty() count!: number;
}

class SeverityCountDto {
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }) severity!: string;
  @ApiProperty() count!: number;
}

export class IssuesSummaryResponseDto {
  @ApiProperty({ type: [TypeCountDto] }) byType!: TypeCountDto[];
  @ApiProperty({ type: [SeverityCountDto] }) bySeverity!: SeverityCountDto[];
  @ApiProperty() total!: number;
}

class RedirectItemDto {
  @ApiProperty() pageId!: string;
  @ApiProperty() url!: string;
  @ApiProperty() statusCode!: number;
  @ApiProperty({ nullable: true }) redirectChainJson!: unknown;
}

export class RedirectsListResponseDto {
  @ApiProperty({ type: [RedirectItemDto] }) items!: RedirectItemDto[];
  @ApiProperty() total!: number;
}

class BrokenLinkItemDto {
  @ApiProperty() linkId!: string;
  @ApiProperty({ nullable: true }) fromPageUrl!: string | null;
  @ApiProperty() toUrl!: string;
  @ApiProperty({ nullable: true }) statusCode!: number | null;
}

export class BrokenLinksListResponseDto {
  @ApiProperty({ type: [BrokenLinkItemDto] }) items!: BrokenLinkItemDto[];
  @ApiProperty() total!: number;
}

class LinkItemDto {
  @ApiProperty() linkId!: string;
  @ApiProperty() toUrl!: string;
  @ApiProperty() linkType!: string;
  @ApiProperty() isBroken!: boolean;
  @ApiProperty({ nullable: true }) statusCode!: number | null;
}

class InlinkItemDto {
  @ApiProperty() linkId!: string;
  @ApiProperty({ nullable: true }) fromPageId!: string | null;
  @ApiProperty({ nullable: true }) fromUrl!: string | null;
}

export class PageDetailsResponseDto {
  @ApiProperty() pageId!: string;
  @ApiProperty() url!: string;
  @ApiProperty() normalizedUrl!: string;
  @ApiProperty({ nullable: true }) statusCode!: number | null;
  @ApiProperty({ nullable: true }) contentType!: string | null;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty({ nullable: true }) metaDescription!: string | null;
  @ApiProperty({ nullable: true }) h1Count!: number | null;
  @ApiProperty({ nullable: true }) canonical!: string | null;
  @ApiProperty({ nullable: true }) robotsMeta!: string | null;
  @ApiProperty({ nullable: true }) wordCount!: number | null;
  @ApiProperty({ nullable: true }) htmlHash!: string | null;
  @ApiProperty({ nullable: true }) redirectChainJson!: unknown;
  @ApiProperty() discoveredAt!: Date;
  @ApiProperty({ type: [IssueItemDto] }) issues!: IssueItemDto[];
  @ApiProperty({ type: [LinkItemDto] }) outgoingLinks!: LinkItemDto[];
  @ApiProperty({ type: [InlinkItemDto] }) inlinks!: InlinkItemDto[];
}
