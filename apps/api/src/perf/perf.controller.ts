import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Post,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PerfService } from './perf.service';
import { PerfAuditsQueryDto, PerfRegressionsQueryDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PerfController {
  constructor(private readonly perfService: PerfService) {}

  /**
   * GET /crawls/:crawlRunId/perf/summary
   * Get performance audit summary for a crawl run
   */
  @Get('crawls/:crawlRunId/perf/summary')
  async getPerfSummary(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
  ) {
    return this.perfService.getPerfSummary(userId, crawlRunId);
  }

  /**
   * GET /crawls/:crawlRunId/perf/audits
   * Get paginated list of performance audits
   */
  @Get('crawls/:crawlRunId/perf/audits')
  async getPerfAudits(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: PerfAuditsQueryDto,
  ) {
    return this.perfService.getPerfAudits(userId, crawlRunId, {
      templateId: query.templateId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * GET /crawls/:crawlRunId/perf/regressions
   * Get paginated list of performance regressions
   */
  @Get('crawls/:crawlRunId/perf/regressions')
  async getPerfRegressions(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
    @Query() query: PerfRegressionsQueryDto,
  ) {
    return this.perfService.getPerfRegressions(userId, crawlRunId, {
      severity: query.severity,
      templateId: query.templateId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * GET /perf-audits/:id/report
   * Stream the HTML report for a performance audit
   */
  @Get('perf-audits/:id/report')
  async getReport(
    @CurrentUser('id') userId: string,
    @Param('id') auditId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const reportPath = await this.perfService.getReportPath(userId, auditId);

    if (!reportPath || !existsSync(reportPath)) {
      throw new NotFoundException('Report not found');
    }

    res.set({
      'Content-Type': 'text/html',
      'Content-Disposition': `inline; filename="lighthouse-report.html"`,
    });

    const stream = createReadStream(reportPath);
    return new StreamableFile(stream);
  }

  /**
   * POST /crawls/:crawlRunId/perf/finalize
   * Trigger regression computation for a crawl run
   */
  @Post('crawls/:crawlRunId/perf/finalize')
  async finalizePerfResults(
    @CurrentUser('id') userId: string,
    @Param('crawlRunId') crawlRunId: string,
  ) {
    return this.perfService.finalizePerfResults(userId, crawlRunId);
  }
}
