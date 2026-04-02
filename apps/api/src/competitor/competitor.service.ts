/**
 * Competitor Analysis Service
 *
 * Compare crawl data between your site and competitor domains.
 * Identifies gaps in content coverage, technical SEO advantages, and areas to improve.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ComparisonResult {
  yourDomain: DomainSummary;
  competitor: DomainSummary;
  advantages: ComparisonItem[];
  gaps: ComparisonItem[];
  opportunities: string[];
}

interface DomainSummary {
  domain: string;
  crawlRunId: string;
  totalPages: number;
  totalIssues: number;
  avgWordCount: number;
  pagesWithH1: number;
  pagesWithCanonical: number;
  pagesWithMetaDesc: number;
  statusCodeDistribution: Record<number, number>;
  issueSeverityDistribution: Record<string, number>;
}

interface ComparisonItem {
  metric: string;
  yours: number | string;
  theirs: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

@Injectable()
export class CompetitorService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(
    userId: string,
    yourProjectId: string,
    yourCrawlRunId: string,
    competitorProjectId: string,
    competitorCrawlRunId: string,
  ): Promise<ComparisonResult> {
    // Verify access to both projects
    for (const projectId of [yourProjectId, competitorProjectId]) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found`);
      const membership = await this.prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: project.orgId, userId } },
      });
      if (!membership) throw new BadRequestException('Access denied');
    }

    const [yourSummary, competitorSummary] = await Promise.all([
      this.buildDomainSummary(yourProjectId, yourCrawlRunId),
      this.buildDomainSummary(competitorProjectId, competitorCrawlRunId),
    ]);

    const advantages: ComparisonItem[] = [];
    const gaps: ComparisonItem[] = [];

    // Compare metrics
    this.compareMetric('Total Pages', yourSummary.totalPages, competitorSummary.totalPages, advantages, gaps);
    this.compareMetric('Avg Word Count', yourSummary.avgWordCount, competitorSummary.avgWordCount, advantages, gaps);
    this.compareMetric('Pages with H1', yourSummary.pagesWithH1, competitorSummary.pagesWithH1, advantages, gaps);
    this.compareMetric('Pages with Canonical', yourSummary.pagesWithCanonical, competitorSummary.pagesWithCanonical, advantages, gaps);
    this.compareMetric('Pages with Meta Desc', yourSummary.pagesWithMetaDesc, competitorSummary.pagesWithMetaDesc, advantages, gaps);
    this.compareMetricInverse('Total Issues', yourSummary.totalIssues, competitorSummary.totalIssues, advantages, gaps);

    // Generate opportunities
    const opportunities: string[] = [];
    if (competitorSummary.totalPages > yourSummary.totalPages * 1.5) {
      opportunities.push(`Competitor has ${competitorSummary.totalPages - yourSummary.totalPages} more pages. Consider expanding content coverage.`);
    }
    if (competitorSummary.avgWordCount > yourSummary.avgWordCount * 1.2) {
      opportunities.push(`Competitor's average word count is ${Math.round(competitorSummary.avgWordCount - yourSummary.avgWordCount)} words higher. Consider enriching thin content pages.`);
    }
    if (yourSummary.totalIssues > competitorSummary.totalIssues) {
      opportunities.push(`You have ${yourSummary.totalIssues - competitorSummary.totalIssues} more SEO issues. Prioritize fixing critical and high severity issues.`);
    }
    const yourCanonicalPct = yourSummary.totalPages > 0 ? yourSummary.pagesWithCanonical / yourSummary.totalPages : 0;
    const theirCanonicalPct = competitorSummary.totalPages > 0 ? competitorSummary.pagesWithCanonical / competitorSummary.totalPages : 0;
    if (theirCanonicalPct > yourCanonicalPct + 0.1) {
      opportunities.push(`Competitor has better canonical coverage (${Math.round(theirCanonicalPct * 100)}% vs your ${Math.round(yourCanonicalPct * 100)}%). Add canonical tags to remaining pages.`);
    }

    return {
      yourDomain: yourSummary,
      competitor: competitorSummary,
      advantages,
      gaps,
      opportunities,
    };
  }

  private compareMetric(name: string, yours: number, theirs: number, advantages: ComparisonItem[], gaps: ComparisonItem[]) {
    const item: ComparisonItem = {
      metric: name,
      yours,
      theirs,
      impact: yours > theirs ? 'positive' : yours < theirs ? 'negative' : 'neutral',
    };
    if (yours > theirs) advantages.push(item);
    else if (yours < theirs) gaps.push(item);
  }

  private compareMetricInverse(name: string, yours: number, theirs: number, advantages: ComparisonItem[], gaps: ComparisonItem[]) {
    const item: ComparisonItem = {
      metric: name,
      yours,
      theirs,
      impact: yours < theirs ? 'positive' : yours > theirs ? 'negative' : 'neutral',
    };
    if (yours < theirs) advantages.push(item);
    else if (yours > theirs) gaps.push(item);
  }

  private async buildDomainSummary(projectId: string, crawlRunId: string): Promise<DomainSummary> {
    const [project, crawlRun, pages, issues] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId }, select: { domain: true } }),
      this.prisma.crawlRun.findUnique({
        where: { id: crawlRunId },
        select: { totalsJson: true },
      }),
      this.prisma.page.findMany({
        where: { crawlRunId },
        select: { statusCode: true, wordCount: true, h1Count: true, canonical: true, metaDescription: true },
      }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: { crawlRunId },
        _count: true,
      }),
    ]);

    const statusDist: Record<number, number> = {};
    let totalWords = 0;
    let pagesWithH1 = 0;
    let pagesWithCanonical = 0;
    let pagesWithMetaDesc = 0;
    let wordCountPages = 0;

    for (const page of pages) {
      if (page.statusCode) statusDist[page.statusCode] = (statusDist[page.statusCode] || 0) + 1;
      if (page.wordCount && page.wordCount > 0) { totalWords += page.wordCount; wordCountPages++; }
      if (page.h1Count && page.h1Count > 0) pagesWithH1++;
      if (page.canonical) pagesWithCanonical++;
      if (page.metaDescription) pagesWithMetaDesc++;
    }

    const severityDist: Record<string, number> = {};
    for (const i of issues) {
      severityDist[i.severity] = i._count;
    }

    const totals = (crawlRun?.totalsJson as Record<string, number>) || {};

    return {
      domain: project?.domain || 'unknown',
      crawlRunId,
      totalPages: totals.totalPages || pages.length,
      totalIssues: totals.totalIssues || 0,
      avgWordCount: wordCountPages > 0 ? Math.round(totalWords / wordCountPages) : 0,
      pagesWithH1,
      pagesWithCanonical,
      pagesWithMetaDesc,
      statusCodeDistribution: statusDist,
      issueSeverityDistribution: severityDist,
    };
  }
}
