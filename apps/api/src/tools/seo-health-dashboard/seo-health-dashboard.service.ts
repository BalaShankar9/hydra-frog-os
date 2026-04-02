/**
 * SEO Health Dashboard - API Service
 *
 * Analyzes crawl data and computes an SEO health score with issue breakdown.
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SeoHealthDashboardInput,
  SeoHealthDashboardOutput,
  validateSeoHealthDashboardInput,
  applySeoHealthDashboardRules,
  generateSeoHealthDashboardOutput,
  RawIssueData,
} from '../../../../packages/shared/src/tools/seo-health-dashboard/rules';

@Injectable()
export class SeoHealthDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, input: SeoHealthDashboardInput): Promise<SeoHealthDashboardOutput> {
    const validation = validateSeoHealthDashboardInput(input);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Verify user has access to the project
    await this.verifyAccess(userId, input.projectId);

    // Verify crawl run belongs to this project
    const crawlRun = await this.prisma.crawlRun.findFirst({
      where: { id: input.crawlRunId, projectId: input.projectId },
      select: { id: true },
    });
    if (!crawlRun) {
      throw new NotFoundException('Crawl run not found in this project');
    }

    // Fetch data
    const [totalPages, issues] = await Promise.all([
      this.prisma.page.count({ where: { crawlRunId: input.crawlRunId } }),
      this.prisma.issue.findMany({
        where: { crawlRunId: input.crawlRunId },
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          description: true,
          recommendation: true,
          pageId: true,
          page: { select: { url: true } },
        },
      }),
    ]);

    const rawIssues: RawIssueData[] = issues.map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      recommendation: i.recommendation,
      pageId: i.pageId,
      pageUrl: i.page?.url ?? null,
    }));

    const results = applySeoHealthDashboardRules(input, rawIssues);
    return generateSeoHealthDashboardOutput(totalPages, results);
  }

  private async verifyAccess(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const membership = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: project.orgId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  async getHistory(userId: string, projectId: string, _limit: number) {
    await this.verifyAccess(userId, projectId);
    return [];
  }

  async getResult(_userId: string, _executionId: string) {
    throw new NotFoundException('Execution not found');
  }

  async exportResults(
    userId: string,
    executionId: string,
    format: 'csv' | 'json' | 'pdf',
  ) {
    const result = await this.getResult(userId, executionId);

    switch (format) {
      case 'json':
        return result;
      default:
        throw new BadRequestException(`Export format '${format}' is not yet supported`);
    }
  }
}
