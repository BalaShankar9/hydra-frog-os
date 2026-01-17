import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { Prisma, IssueSeverity } from '@prisma/client';
import {
  ListPagesQueryDto,
  ListIssuesQueryDto,
  PaginationDto,
  PagesListResponse,
  IssuesListResponse,
  IssuesSummaryResponse,
  RedirectsListResponse,
  BrokenLinksListResponse,
  PageDetailsResponse,
} from './dto/crawl-data.dto';

@Injectable()
export class CrawlDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  /**
   * Verify user has access to crawl run via org membership
   */
  private async verifyCrawlRunAccess(userId: string, crawlRunId: string) {
    const crawlRun = await this.prisma.crawlRun.findUnique({
      where: { id: crawlRunId },
      include: {
        project: {
          select: { orgId: true },
        },
      },
    });

    if (!crawlRun) {
      throw new NotFoundException('Crawl run not found');
    }

    await this.orgService.assertOrgMember(userId, crawlRun.project.orgId);
    return crawlRun;
  }

  /**
   * Verify user has access to page via org membership
   */
  private async verifyPageAccess(userId: string, pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: {
        crawlRun: {
          include: {
            project: {
              select: { orgId: true },
            },
          },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.orgService.assertOrgMember(userId, page.crawlRun.project.orgId);
    return page;
  }

  /**
   * GET /crawls/:crawlRunId/pages
   */
  async listPages(
    userId: string,
    crawlRunId: string,
    query: ListPagesQueryDto,
  ): Promise<PagesListResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    const { page = 1, pageSize = 50, q, status, hasIssues } = query;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.PageWhereInput = {
      crawlRunId,
    };

    if (status !== undefined) {
      where.statusCode = status;
    }

    if (q) {
      where.OR = [
        { url: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (hasIssues !== undefined) {
      if (hasIssues) {
        where.issues = { some: {} };
      } else {
        where.issues = { none: {} };
      }
    }

    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { discoveredAt: 'asc' },
        select: {
          id: true,
          url: true,
          statusCode: true,
          title: true,
          metaDescription: true,
          h1Count: true,
          canonical: true,
          robotsMeta: true,
          wordCount: true,
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      items: pages.map((p) => ({
        pageId: p.id,
        url: p.url,
        statusCode: p.statusCode,
        title: p.title,
        metaDescription: p.metaDescription,
        h1Count: p.h1Count,
        canonical: p.canonical,
        robotsMeta: p.robotsMeta,
        wordCount: p.wordCount,
      })),
      total,
    };
  }

  /**
   * GET /crawls/:crawlRunId/issues
   */
  async listIssues(
    userId: string,
    crawlRunId: string,
    query: ListIssuesQueryDto,
  ): Promise<IssuesListResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    const { page = 1, pageSize = 50, type, severity } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.IssueWhereInput = {
      crawlRunId,
    };

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity as IssueSeverity;
    }

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          page: {
            select: { url: true },
          },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      items: issues.map((i) => ({
        issueId: i.id,
        pageId: i.pageId,
        url: i.page?.url ?? null,
        type: i.type,
        severity: i.severity,
        title: i.title,
        description: i.description,
        recommendation: i.recommendation,
      })),
      total,
    };
  }

  /**
   * GET /crawls/:crawlRunId/issues/summary
   */
  async getIssuesSummary(
    userId: string,
    crawlRunId: string,
  ): Promise<IssuesSummaryResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    const [byType, bySeverity, total] = await Promise.all([
      this.prisma.issue.groupBy({
        by: ['type'],
        where: { crawlRunId },
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } },
      }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: { crawlRunId },
        _count: { severity: true },
        orderBy: { severity: 'asc' },
      }),
      this.prisma.issue.count({ where: { crawlRunId } }),
    ]);

    return {
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count.type,
      })),
      bySeverity: bySeverity.map((item) => ({
        severity: item.severity,
        count: item._count.severity,
      })),
      total,
    };
  }

  /**
   * GET /crawls/:crawlRunId/redirects
   */
  async listRedirects(
    userId: string,
    crawlRunId: string,
    query: PaginationDto,
  ): Promise<RedirectsListResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    const { page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PageWhereInput = {
      crawlRunId,
      statusCode: { gte: 300, lt: 400 },
    };

    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { discoveredAt: 'asc' },
        select: {
          id: true,
          url: true,
          statusCode: true,
          redirectChainJson: true,
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      items: pages.map((p) => ({
        pageId: p.id,
        url: p.url,
        statusCode: p.statusCode!,
        redirectChainJson: p.redirectChainJson,
      })),
      total,
    };
  }

  /**
   * GET /crawls/:crawlRunId/broken-links
   */
  async listBrokenLinks(
    userId: string,
    crawlRunId: string,
    query: PaginationDto,
  ): Promise<BrokenLinksListResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    const { page = 1, pageSize = 50 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.LinkWhereInput = {
      crawlRunId,
      isBroken: true,
    };

    const [links, total] = await Promise.all([
      this.prisma.link.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          fromPage: {
            select: { url: true },
          },
        },
      }),
      this.prisma.link.count({ where }),
    ]);

    return {
      items: links.map((l) => ({
        linkId: l.id,
        fromPageUrl: l.fromPage?.url ?? null,
        toUrl: l.toUrl,
        statusCode: l.statusCode,
      })),
      total,
    };
  }

  /**
   * GET /pages/:pageId/details
   */
  async getPageDetails(
    userId: string,
    pageId: string,
  ): Promise<PageDetailsResponse> {
    const page = await this.verifyPageAccess(userId, pageId);

    // Get issues, outgoing links, and inlinks in parallel
    const [issues, outgoingLinks, inlinks] = await Promise.all([
      this.prisma.issue.findMany({
        where: { pageId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.link.findMany({
        where: { fromPageId: pageId },
        orderBy: { createdAt: 'asc' },
      }),
      // Inlinks: find links that point to this page's URL
      this.prisma.link.findMany({
        where: {
          crawlRunId: page.crawlRunId,
          toNormalizedUrl: page.normalizedUrl,
        },
        include: {
          fromPage: {
            select: { url: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      pageId: page.id,
      url: page.url,
      normalizedUrl: page.normalizedUrl,
      statusCode: page.statusCode,
      contentType: page.contentType,
      title: page.title,
      metaDescription: page.metaDescription,
      h1Count: page.h1Count,
      canonical: page.canonical,
      robotsMeta: page.robotsMeta,
      wordCount: page.wordCount,
      htmlHash: page.htmlHash,
      redirectChainJson: page.redirectChainJson,
      discoveredAt: page.discoveredAt,
      issues: issues.map((i) => ({
        issueId: i.id,
        pageId: i.pageId,
        url: page.url,
        type: i.type,
        severity: i.severity,
        title: i.title,
        description: i.description,
        recommendation: i.recommendation,
        evidenceJson: i.evidenceJson,
      })),
      outgoingLinks: outgoingLinks.map((l) => ({
        linkId: l.id,
        toUrl: l.toUrl,
        linkType: l.linkType,
        isBroken: l.isBroken,
        statusCode: l.statusCode,
      })),
      inlinks: inlinks.map((l) => ({
        linkId: l.id,
        fromPageId: l.fromPageId,
        fromUrl: l.fromPage?.url ?? null,
      })),
    };
  }
}
