import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { CrawlService } from './crawl.service';
import { CrawlDataService } from './crawl-data.service';
import {
  CancelCrawlDto,
  ListPagesQueryDto,
  ListIssuesQueryDto,
  PaginationDto,
  PagesListResponse,
  IssuesListResponse,
  IssuesSummaryResponse,
  RedirectsListResponse,
  BrokenLinksListResponse,
  PageDetailsResponse,
  PagesListResponseDto,
  IssuesListResponseDto,
  IssuesSummaryResponseDto,
  RedirectsListResponseDto,
  BrokenLinksListResponseDto,
  PageDetailsResponseDto,
} from './dto';

interface JwtUser {
  id: string;
  email: string;
}

@ApiTags('crawls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CrawlController {
  constructor(
    private readonly crawlService: CrawlService,
    private readonly crawlDataService: CrawlDataService,
  ) {}

  @Post('projects/:projectId/crawls/run-now')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new crawl run' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Crawl queued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - viewers cannot run crawls' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Crawl already in progress' })
  async runNow(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
  ) {
    return this.crawlService.runNow(user.id, projectId);
  }

  @Post('projects/:projectId/crawls/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a crawl run' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Crawl cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel crawl in current state' })
  @ApiResponse({ status: 403, description: 'Forbidden - viewers cannot cancel crawls' })
  @ApiResponse({ status: 404, description: 'No active crawl to cancel' })
  async cancel(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Body() body: CancelCrawlDto,
  ) {
    return this.crawlService.cancel(user.id, projectId, body.crawlRunId);
  }

  @Get('projects/:projectId/crawls')
  @ApiOperation({ summary: 'List crawl runs for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of crawl runs' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async listCrawls(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
  ) {
    return this.crawlService.listCrawlRuns(user.id, projectId);
  }

  @Get('crawls/:crawlRunId')
  @ApiOperation({ summary: 'Get crawl run details' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiResponse({ status: 200, description: 'Crawl run details' })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async getCrawlRun(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
  ) {
    return this.crawlService.getCrawlRun(user.id, crawlRunId);
  }

  // ============================================
  // Crawl Data Endpoints
  // ============================================

  @Get('crawls/:crawlRunId/pages')
  @ApiOperation({ summary: 'List pages for a crawl run' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by URL or title' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status code' })
  @ApiQuery({ name: 'hasIssues', required: false, enum: ['true', 'false'], description: 'Filter pages with/without issues' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'List of pages', type: PagesListResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async listPages(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: ListPagesQueryDto,
  ): Promise<PagesListResponse> {
    return this.crawlDataService.listPages(user.id, crawlRunId, query);
  }

  @Get('crawls/:crawlRunId/issues')
  @ApiOperation({ summary: 'List issues for a crawl run' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by issue type' })
  @ApiQuery({ name: 'severity', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Filter by severity' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'List of issues', type: IssuesListResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async listIssues(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: ListIssuesQueryDto,
  ): Promise<IssuesListResponse> {
    return this.crawlDataService.listIssues(user.id, crawlRunId, query);
  }

  @Get('crawls/:crawlRunId/issues/summary')
  @ApiOperation({ summary: 'Get issue summary for a crawl run' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiResponse({ status: 200, description: 'Issue summary', type: IssuesSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async getIssuesSummary(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
  ): Promise<IssuesSummaryResponse> {
    return this.crawlDataService.getIssuesSummary(user.id, crawlRunId);
  }

  @Get('crawls/:crawlRunId/redirects')
  @ApiOperation({ summary: 'List redirect pages for a crawl run' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'List of redirect pages', type: RedirectsListResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async listRedirects(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: PaginationDto,
  ): Promise<RedirectsListResponse> {
    return this.crawlDataService.listRedirects(user.id, crawlRunId, query);
  }

  @Get('crawls/:crawlRunId/broken-links')
  @ApiOperation({ summary: 'List broken links for a crawl run' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'List of broken links', type: BrokenLinksListResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async listBrokenLinks(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: PaginationDto,
  ): Promise<BrokenLinksListResponse> {
    return this.crawlDataService.listBrokenLinks(user.id, crawlRunId, query);
  }

  @Get('pages/:pageId/details')
  @ApiOperation({ summary: 'Get page details including issues and links' })
  @ApiParam({ name: 'pageId', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'Page details', type: PageDetailsResponseDto })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async getPageDetails(
    @CurrentUser() user: JwtUser,
    @Param('pageId') pageId: string,
  ): Promise<PageDetailsResponse> {
    return this.crawlDataService.getPageDetails(user.id, pageId);
  }
}
