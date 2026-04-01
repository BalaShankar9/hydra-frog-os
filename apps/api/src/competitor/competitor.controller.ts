import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators';
import { CompetitorService } from './competitor.service';

@ApiTags('Competitor Analysis')
@Controller('competitor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompetitorController {
  constructor(private readonly competitorService: CompetitorService) {}

  @Get('compare')
  @ApiOperation({ summary: 'Compare your crawl data against a competitor' })
  async compare(
    @CurrentUser() user: CurrentUserPayload,
    @Query('yourProjectId') yourProjectId: string,
    @Query('yourCrawlRunId') yourCrawlRunId: string,
    @Query('competitorProjectId') competitorProjectId: string,
    @Query('competitorCrawlRunId') competitorCrawlRunId: string,
  ) {
    return this.competitorService.compare(
      user.id,
      yourProjectId,
      yourCrawlRunId,
      competitorProjectId,
      competitorCrawlRunId,
    );
  }
}
