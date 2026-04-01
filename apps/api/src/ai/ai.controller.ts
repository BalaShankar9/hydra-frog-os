import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators';
import { AiService } from './ai.service';

class AiQueryDto {
  projectId: string;
  crawlRunId: string;
  question: string;
}

@ApiTags('AI Copilot')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  @ApiOperation({ summary: 'Ask the AI SEO Copilot a question about crawl data' })
  async query(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AiQueryDto,
  ) {
    return this.aiService.query(user.id, dto);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get AI-powered SEO improvement suggestions' })
  async suggestions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId: string,
    @Query('crawlRunId') crawlRunId: string,
  ) {
    return this.aiService.getSuggestions(user.id, projectId, crawlRunId);
  }
}
