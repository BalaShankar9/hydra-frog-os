import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Body,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FixesService } from './fixes.service';
import { FixesQueryDto, UpdateFixStatusDto } from './dto';

@ApiTags('fixes')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class FixesController {
  constructor(private readonly fixesService: FixesService) {}

  /**
   * GET /crawls/:crawlRunId/fixes
   * List fix suggestions for a crawl run
   */
  @Get('crawls/:crawlRunId/fixes')
  @ApiOperation({ summary: 'List fix suggestions for a crawl run' })
  @ApiResponse({ status: 200, description: 'List of fix suggestions' })
  async listFixes(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: FixesQueryDto,
  ) {
    return this.fixesService.listFixes(userId, crawlRunId, {
      templateId: query.templateId,
      status: query.status,
      fixType: query.fixType,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * GET /crawls/:crawlRunId/fixes/summary
   * Get summary of fix suggestions for a crawl run
   */
  @Get('crawls/:crawlRunId/fixes/summary')
  @ApiOperation({ summary: 'Get fix suggestions summary for a crawl run' })
  @ApiResponse({ status: 200, description: 'Fix suggestions summary' })
  async getFixesSummary(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
  ) {
    return this.fixesService.getFixesSummary(userId, crawlRunId);
  }

  /**
   * GET /crawls/:crawlRunId/fixes/export.csv
   * Export fixes as CSV
   */
  @Get('crawls/:crawlRunId/fixes/export.csv')
  @ApiOperation({ summary: 'Export fix suggestions as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @Header('Content-Type', 'text/csv')
  async exportFixesCsv(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
    @Res() res: Response,
  ) {
    const csv = await this.fixesService.exportFixesCsv(userId, crawlRunId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fixes-${crawlRunId}.csv"`,
    );
    res.send(csv);
  }

  /**
   * GET /crawls/:crawlRunId/fixpack.md
   * Generate and return fix pack markdown
   */
  @Get('crawls/:crawlRunId/fixpack.md')
  @ApiOperation({ summary: 'Generate fix pack markdown' })
  @ApiResponse({ status: 200, description: 'Markdown file' })
  @Header('Content-Type', 'text/markdown')
  async getFixPack(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
    @Res() res: Response,
  ) {
    const markdown = await this.fixesService.generateFixPack(userId, crawlRunId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fixpack-${crawlRunId}.md"`,
    );
    res.send(markdown);
  }

  /**
   * GET /fixes/:fixSuggestionId
   * Get fix suggestion detail
   */
  @Get('fixes/:fixSuggestionId')
  @ApiOperation({ summary: 'Get fix suggestion detail' })
  @ApiResponse({ status: 200, description: 'Fix suggestion detail' })
  async getFixDetail(
    @CurrentUser('id') userId: string,
    @Param('fixSuggestionId') fixSuggestionId: string,
  ) {
    return this.fixesService.getFixDetail(userId, fixSuggestionId);
  }

  /**
   * PATCH /fixes/:fixSuggestionId/status
   * Update fix suggestion status
   */
  @Patch('fixes/:fixSuggestionId/status')
  @ApiOperation({ summary: 'Update fix suggestion status' })
  @ApiResponse({ status: 200, description: 'Updated fix suggestion' })
  async updateFixStatus(
    @CurrentUser('id') userId: string,
    @Param('fixSuggestionId') fixSuggestionId: string,
    @Body() body: UpdateFixStatusDto,
  ) {
    return this.fixesService.updateFixStatus(userId, fixSuggestionId, body.status);
  }
}
