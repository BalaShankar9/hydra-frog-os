import {
  Controller,
  Get,
  Post,
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
import { DiffService } from './diff.service';
import {
  ListDiffItemsQueryDto,
  CompareRunsDto,
  DiffResponse,
  DiffItemsListResponse,
  CompareResponse,
  DiffResponseDto,
  DiffItemsListResponseDto,
  CompareResponseDto,
} from './dto';

interface JwtUser {
  id: string;
  email: string;
}

@ApiTags('diffs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DiffController {
  constructor(private readonly diffService: DiffService) {}

  // ============================================
  // GET /crawls/:toRunId/diff
  // ============================================
  @Get('crawls/:toRunId/diff')
  @ApiOperation({ summary: 'Get diff for a crawl run (auto-generated diff vs previous run)' })
  @ApiParam({ name: 'toRunId', description: 'Crawl Run ID (the "to" run in the comparison)' })
  @ApiResponse({ status: 200, description: 'Diff summary', type: DiffResponseDto })
  @ApiResponse({ status: 404, description: 'Crawl run or diff not found' })
  async getDiffForCrawlRun(
    @CurrentUser() user: JwtUser,
    @Param('toRunId') toRunId: string,
  ): Promise<DiffResponse> {
    return this.diffService.getDiffForCrawlRun(user.id, toRunId);
  }

  // ============================================
  // GET /diffs/:diffId
  // ============================================
  @Get('diffs/:diffId')
  @ApiOperation({ summary: 'Get diff by ID' })
  @ApiParam({ name: 'diffId', description: 'Diff ID' })
  @ApiResponse({ status: 200, description: 'Diff details', type: DiffResponseDto })
  @ApiResponse({ status: 404, description: 'Diff not found' })
  async getDiff(
    @CurrentUser() user: JwtUser,
    @Param('diffId') diffId: string,
  ): Promise<DiffResponse> {
    return this.diffService.getDiffById(user.id, diffId);
  }

  // ============================================
  // GET /diffs/:diffId/items
  // ============================================
  @Get('diffs/:diffId/items')
  @ApiOperation({ summary: 'List diff items with filtering and pagination' })
  @ApiParam({ name: 'diffId', description: 'Diff ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by diff type (e.g., STATUS_CHANGED, TITLE_CHANGED)' })
  @ApiQuery({ name: 'severity', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Filter by severity' })
  @ApiQuery({ name: 'direction', required: false, enum: ['REGRESSION', 'IMPROVEMENT', 'NEUTRAL'], description: 'Filter by direction' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by URL (contains)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (max 200)' })
  @ApiResponse({ status: 200, description: 'List of diff items', type: DiffItemsListResponseDto })
  @ApiResponse({ status: 404, description: 'Diff not found' })
  async listDiffItems(
    @CurrentUser() user: JwtUser,
    @Param('diffId') diffId: string,
    @Query() query: ListDiffItemsQueryDto,
  ): Promise<DiffItemsListResponse> {
    return this.diffService.listDiffItems(user.id, diffId, query);
  }

  // ============================================
  // POST /projects/:projectId/compare
  // ============================================
  @Post('projects/:projectId/compare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compare two crawl runs manually' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Comparison result', type: CompareResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid run IDs or runs not in DONE status' })
  @ApiResponse({ status: 404, description: 'Project or crawl runs not found' })
  async compareRuns(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Body() body: CompareRunsDto,
  ): Promise<CompareResponse> {
    return this.diffService.compareRuns(
      user.id,
      projectId,
      body.fromRunId,
      body.toRunId,
    );
  }
}
