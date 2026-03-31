import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { Prisma, IssueSeverity } from '@prisma/client';
import {
  ListTemplatePagesQueryDto,
  ListTemplateIssuesQueryDto,
  TemplatesListResponse,
  TemplateDetailResponse,
  TemplatePagesResponse,
  TemplateIssuesResponse,
  SeverityCounts,
  TopIssueType,
} from './dto';

@Injectable()
export class TemplatesService {
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
   * Verify user has access to template via org membership
   */
  private async verifyTemplateAccess(userId: string, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
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

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.orgService.assertOrgMember(userId, template.crawlRun.project.orgId);
    return template;
  }

  /**
   * GET /crawls/:crawlRunId/templates
   * List templates for a crawl run with issue aggregates
   */
  async listTemplates(
    userId: string,
    crawlRunId: string,
  ): Promise<TemplatesListResponse> {
    await this.verifyCrawlRunAccess(userId, crawlRunId);

    // Fetch all templates for this crawl run
    const templates = await this.prisma.template.findMany({
      where: { crawlRunId },
      orderBy: { pageCount: 'desc' },
      include: {
        pages: {
          take: 1,
          select: { url: true },
        },
      },
    });

    if (templates.length === 0) {
      return {
        items: [],
        totalTemplates: 0,
      };
    }

    // Get all template IDs
    const templateIds = templates.map((t) => t.id);

    // Aggregate issues by template using a single optimized query
    // Get all pages for these templates with issue counts
    const issueAggregates = await this.prisma.$queryRaw<
      Array<{
        templateId: string;
        severity: IssueSeverity;
        type: string;
        count: bigint;
      }>
    >`
      SELECT 
        p."templateId",
        i.severity,
        i.type,
        COUNT(*)::bigint as count
      FROM "Issue" i
      INNER JOIN "Page" p ON i."pageId" = p.id
      WHERE p."templateId" IN (${Prisma.join(templateIds)})
      GROUP BY p."templateId", i.severity, i.type
    `;

    // Build aggregate maps for each template
    const templateAggregates = new Map<
      string,
      {
        total: number;
        severityCounts: SeverityCounts;
        typeCounts: Map<string, number>;
      }
    >();

    // Initialize aggregates for all templates
    for (const templateId of templateIds) {
      templateAggregates.set(templateId, {
        total: 0,
        severityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        typeCounts: new Map(),
      });
    }

    // Process raw query results
    for (const row of issueAggregates) {
      const agg = templateAggregates.get(row.templateId);
      if (agg) {
        const count = Number(row.count);
        agg.total += count;
        agg.severityCounts[row.severity] += count;
        
        const currentTypeCount = agg.typeCounts.get(row.type) || 0;
        agg.typeCounts.set(row.type, currentTypeCount + count);
      }
    }

    // Build response items
    const items = templates.map((template) => {
      const agg = templateAggregates.get(template.id)!;
      
      // Sort types by count and take top 5
      const topIssueTypes: TopIssueType[] = Array.from(agg.typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      return {
        templateId: template.id,
        name: template.name,
        pageCount: template.pageCount,
        sampleUrl: template.pages[0]?.url ?? null,
        issueCountTotal: agg.total,
        severityCounts: agg.severityCounts,
        topIssueTypes,
      };
    });

    return {
      items,
      totalTemplates: templates.length,
    };
  }

  /**
   * GET /templates/:templateId
   * Get template detail
   */
  async getTemplate(
    userId: string,
    templateId: string,
  ): Promise<TemplateDetailResponse> {
    const template = await this.verifyTemplateAccess(userId, templateId);

    // Get a sample page URL
    const samplePage = await this.prisma.page.findFirst({
      where: { templateId },
      select: { url: true },
    });

    return {
      id: template.id,
      crawlRunId: template.crawlRunId,
      name: template.name,
      pageCount: template.pageCount,
      sampleUrl: samplePage?.url ?? null,
    };
  }

  /**
   * GET /templates/:templateId/pages
   * List pages under a template with pagination and filters
   */
  async listTemplatePages(
    userId: string,
    templateId: string,
    query: ListTemplatePagesQueryDto,
  ): Promise<TemplatePagesResponse> {
    await this.verifyTemplateAccess(userId, templateId);

    const { page = 1, pageSize = 50, q, status, hasIssues } = query;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.PageWhereInput = {
      templateId,
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
   * GET /templates/:templateId/issues
   * List issues for pages under a template
   */
  async listTemplateIssues(
    userId: string,
    templateId: string,
    query: ListTemplateIssuesQueryDto,
  ): Promise<TemplateIssuesResponse> {
    const template = await this.verifyTemplateAccess(userId, templateId);

    const { page = 1, pageSize = 50, type, severity } = query;
    const skip = (page - 1) * pageSize;

    // Build where clause - issues where page.templateId == templateId
    const where: Prisma.IssueWhereInput = {
      crawlRunId: template.crawlRunId,
      page: {
        templateId,
      },
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
}
