import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
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
import { TemplatesService } from './templates.service';
import {
  ListTemplatePagesQueryDto,
  ListTemplateIssuesQueryDto,
  TemplatesListResponse,
  TemplateDetailResponse,
  TemplatePagesResponse,
  TemplateIssuesResponse,
  TemplatesListResponseDto,
  TemplateDetailResponseDto,
  TemplatePagesResponseDto,
  TemplateIssuesResponseDto,
} from './dto';

interface JwtUser {
  id: string;
  email: string;
}

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ============================================
  // GET /crawls/:crawlRunId/templates
  // ============================================
  @Get('crawls/:crawlRunId/templates')
  @ApiOperation({ summary: 'List templates for a crawl run with issue aggregates' })
  @ApiParam({ name: 'crawlRunId', description: 'Crawl Run ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of templates with issue summaries', 
    type: TemplatesListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Crawl run not found' })
  async listTemplates(
    @CurrentUser() user: JwtUser,
    @Param('crawlRunId') crawlRunId: string,
  ): Promise<TemplatesListResponse> {
    return this.templatesService.listTemplates(user.id, crawlRunId);
  }

  // ============================================
  // GET /templates/:templateId
  // ============================================
  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get template detail' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template details', 
    type: TemplateDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(
    @CurrentUser() user: JwtUser,
    @Param('templateId') templateId: string,
  ): Promise<TemplateDetailResponse> {
    return this.templatesService.getTemplate(user.id, templateId);
  }

  // ============================================
  // GET /templates/:templateId/pages
  // ============================================
  @Get('templates/:templateId/pages')
  @ApiOperation({ summary: 'List pages under a template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by URL or title' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status code' })
  @ApiQuery({ name: 'hasIssues', required: false, enum: ['true', 'false'], description: 'Filter pages with/without issues' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of pages under this template', 
    type: TemplatePagesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async listTemplatePages(
    @CurrentUser() user: JwtUser,
    @Param('templateId') templateId: string,
    @Query() query: ListTemplatePagesQueryDto,
  ): Promise<TemplatePagesResponse> {
    return this.templatesService.listTemplatePages(user.id, templateId, query);
  }

  // ============================================
  // GET /templates/:templateId/issues
  // ============================================
  @Get('templates/:templateId/issues')
  @ApiOperation({ summary: 'List issues for pages under a template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by issue type' })
  @ApiQuery({ name: 'severity', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Filter by severity' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of issues for pages under this template', 
    type: TemplateIssuesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async listTemplateIssues(
    @CurrentUser() user: JwtUser,
    @Param('templateId') templateId: string,
    @Query() query: ListTemplateIssuesQueryDto,
  ): Promise<TemplateIssuesResponse> {
    return this.templatesService.listTemplateIssues(user.id, templateId, query);
  }
}
