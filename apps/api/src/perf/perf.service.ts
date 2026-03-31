import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PerfAuditStatus, PerfRegressionSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgService } from '../org/org.service';

export interface PerfSummary {
  queued: number;
  running: number;
  done: number;
  failed: number;
  avgScore: number | null;
  worstTemplates: Array<{
    templateId: string;
    name: string | null;
    avgScore: number;
    lcpAvg: number | null;
  }>;
  regressionCount: number;
  device: string;
  mode: string;
}

@Injectable()
export class PerfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  /**
   * Verify user has access to the crawl run
   */
  private async verifyCrawlAccess(userId: string, crawlRunId: string) {
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
   * Get performance audit summary for a crawl run
   */
  async getPerfSummary(userId: string, crawlRunId: string): Promise<PerfSummary> {
    const crawlRun = await this.verifyCrawlAccess(userId, crawlRunId);

    // Get status counts
    const statusCounts = await this.prisma.perfAudit.groupBy({
      by: ['status'],
      where: { crawlRunId },
      _count: true,
    });

    const counts = {
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
      skipped: 0,
    };

    for (const { status, _count } of statusCounts) {
      const key = status.toLowerCase() as keyof typeof counts;
      if (key in counts) {
        counts[key] = _count;
      }
    }

    // Get average score from completed audits
    const scoreAgg = await this.prisma.perfAudit.aggregate({
      where: {
        crawlRunId,
        status: 'DONE',
        score: { not: null },
      },
      _avg: { score: true },
    });

    // Get worst templates (by avg score)
    const templateScores = await this.prisma.perfAudit.groupBy({
      by: ['templateId'],
      where: {
        crawlRunId,
        status: 'DONE',
        templateId: { not: null },
      },
      _avg: { score: true },
      orderBy: { _avg: { score: 'asc' } },
      take: 5,
    });

    // Get template names and LCP averages
    const worstTemplates = await Promise.all(
      templateScores.map(async (t) => {
        const template = await this.prisma.template.findUnique({
          where: { id: t.templateId! },
          select: { name: true },
        });

        // Get LCP average for this template
        const audits = await this.prisma.perfAudit.findMany({
          where: {
            crawlRunId,
            templateId: t.templateId,
            status: 'DONE',
          },
          select: { metricsJson: true },
        });

        const lcpValues = audits
          .map((a) => {
            const m = a.metricsJson as { lcp?: number } | null;
            return m?.lcp;
          })
          .filter((v): v is number => v !== undefined && v !== null);

        const lcpAvg =
          lcpValues.length > 0
            ? Math.round(lcpValues.reduce((sum, v) => sum + v, 0) / lcpValues.length)
            : null;

        return {
          templateId: t.templateId!,
          name: template?.name || null,
          avgScore: Math.round(t._avg.score ?? 0),
          lcpAvg,
        };
      }),
    );

    // Get regression count
    const regressionCount = await this.prisma.perfRegressionItem.count({
      where: { crawlRunId },
    });

    // Get device and mode from totalsJson
    const totals = (crawlRun.totalsJson ?? {}) as Record<string, unknown>;

    return {
      queued: counts.queued,
      running: counts.running,
      done: counts.done,
      failed: counts.failed,
      avgScore: scoreAgg._avg.score ? Math.round(scoreAgg._avg.score) : null,
      worstTemplates,
      regressionCount,
      device: (totals.perfDevice as string) || 'MOBILE',
      mode: (totals.perfMode as string) || 'KEY_PAGES',
    };
  }

  /**
   * Get paginated list of performance audits
   */
  async getPerfAudits(
    userId: string,
    crawlRunId: string,
    options: {
      templateId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.verifyCrawlAccess(userId, crawlRunId);

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PerfAuditWhereInput = {
      crawlRunId,
    };

    if (options.templateId) {
      where.templateId = options.templateId;
    }

    if (options.status) {
      where.status = options.status.toUpperCase() as PerfAuditStatus;
    }

    const [audits, total] = await Promise.all([
      this.prisma.perfAudit.findMany({
        where,
        select: {
          id: true,
          url: true,
          device: true,
          status: true,
          score: true,
          metricsJson: true,
          templateId: true,
          finishedAt: true,
          errorJson: true,
          template: {
            select: { name: true },
          },
        },
        orderBy: [{ score: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.perfAudit.count({ where }),
    ]);

    // Transform metrics for response
    const items = audits.map((audit) => {
      const m = (audit.metricsJson ?? {}) as Record<string, unknown>;
      return {
        id: audit.id,
        url: audit.url,
        device: audit.device,
        status: audit.status,
        score: audit.score,
        templateId: audit.templateId,
        templateName: audit.template?.name || null,
        finishedAt: audit.finishedAt,
        error: audit.errorJson
          ? (audit.errorJson as { message?: string }).message
          : null,
        metrics: {
          lcp: m.lcp ?? null,
          cls: m.cls ?? null,
          inp: m.inp ?? m.tbt ?? null,
          tbt: m.tbt ?? null,
          totalTransferSize: m.totalTransferSize ?? null,
        },
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get paginated list of performance regressions
   */
  async getPerfRegressions(
    userId: string,
    crawlRunId: string,
    options: {
      severity?: string;
      templateId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.verifyCrawlAccess(userId, crawlRunId);

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PerfRegressionItemWhereInput = {
      crawlRunId,
    };

    if (options.severity) {
      where.severity = options.severity.toUpperCase() as PerfRegressionSeverity;
    }

    if (options.templateId) {
      where.templateId = options.templateId;
    }

    const [regressions, total] = await Promise.all([
      this.prisma.perfRegressionItem.findMany({
        where,
        select: {
          id: true,
          url: true,
          type: true,
          severity: true,
          beforeJson: true,
          afterJson: true,
          deltaJson: true,
          templateId: true,
          createdAt: true,
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.perfRegressionItem.count({ where }),
    ]);

    // Get template names
    const templateIds = [...new Set(regressions.map(r => r.templateId).filter(Boolean))] as string[];
    const templates = templateIds.length > 0 
      ? await this.prisma.template.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true },
        })
      : [];
    const templateMap = new Map(templates.map(t => [t.id, t.name]));

    const items = regressions.map((r) => {
      const delta = r.deltaJson as {
        type?: string;
        before?: number | null;
        after?: number | null;
        delta?: number;
      } | null;

      return {
        id: r.id,
        url: r.url,
        regressionType: r.type,
        severity: r.severity,
        templateId: r.templateId,
        templateName: r.templateId ? templateMap.get(r.templateId) || null : null,
        createdAt: r.createdAt,
        delta: {
          type: delta?.type || r.type,
          before: delta?.before ?? null,
          after: delta?.after ?? null,
          change: delta?.delta ?? null,
        },
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a single perf audit by ID
   */
  async getPerfAudit(userId: string, auditId: string) {
    const audit = await this.prisma.perfAudit.findUnique({
      where: { id: auditId },
      include: {
        crawlRun: {
          include: {
            project: { select: { orgId: true } },
          },
        },
        template: { select: { name: true } },
      },
    });

    if (!audit) {
      throw new NotFoundException('Perf audit not found');
    }

    await this.orgService.assertOrgMember(userId, audit.crawlRun.project.orgId);

    return audit;
  }

  /**
   * Get the HTML report path for an audit
   */
  async getReportPath(userId: string, auditId: string): Promise<string | null> {
    const audit = await this.getPerfAudit(userId, auditId);
    return audit.reportHtmlPath;
  }

  /**
   * Trigger regression computation for a crawl run
   */
  async finalizePerfResults(userId: string, crawlRunId: string) {
    const crawlRun = await this.verifyCrawlAccess(userId, crawlRunId);

    // Import and run the regression computation
    // Note: In production, this would be handled by the worker
    // For now, we just return status
    const totals = (crawlRun.totalsJson ?? {}) as Record<string, unknown>;

    return {
      crawlRunId,
      device: totals.perfDevice || 'MOBILE',
      message: 'Regression computation should be triggered via worker',
    };
  }
}
