import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FixStatus, FixType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface FixesSummary {
  total: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  criticalCount: number;
  regressionCount: number;
  topFixTypes: Array<{ fixType: FixType; count: number }>;
  byTemplate: Array<{ templateId: string | null; templateName: string | null; count: number }>;
}

@Injectable()
export class FixesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify user has access to the crawl run
   */
  private async verifyCrawlAccess(userId: string, crawlRunId: string) {
    const crawlRun = await this.prisma.crawlRun.findUnique({
      where: { id: crawlRunId },
      include: {
        project: {
          include: {
            org: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!crawlRun) {
      throw new NotFoundException('Crawl run not found');
    }

    const isMember = crawlRun.project.org.members.some(
      (m) => m.userId === userId,
    );
    if (!isMember) {
      throw new NotFoundException('Crawl run not found');
    }

    return crawlRun;
  }

  /**
   * Verify user has access to a fix suggestion
   */
  private async verifyFixAccess(userId: string, fixSuggestionId: string) {
    const fix = await this.prisma.fixSuggestion.findUnique({
      where: { id: fixSuggestionId },
      include: {
        project: {
          include: {
            org: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!fix) {
      throw new NotFoundException('Fix suggestion not found');
    }

    const isMember = fix.project.org.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new NotFoundException('Fix suggestion not found');
    }

    return fix;
  }

  /**
   * GET /crawls/:crawlRunId/fixes
   * List fix suggestions with filtering and pagination
   */
  async listFixes(
    userId: string,
    crawlRunId: string,
    options: {
      templateId?: string;
      status?: FixStatus;
      fixType?: FixType;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.verifyCrawlAccess(userId, crawlRunId);

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.FixSuggestionWhereInput = {
      crawlRunId,
    };

    if (options.templateId) {
      where.templateId = options.templateId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.fixType) {
      where.fixType = options.fixType;
    }

    const [items, total] = await Promise.all([
      this.prisma.fixSuggestion.findMany({
        where,
        select: {
          id: true,
          fixType: true,
          status: true,
          priorityScore: true,
          impactScore: true,
          effortScore: true,
          title: true,
          summary: true,
          affectedPagesCount: true,
          templateId: true,
          createdAt: true,
          updatedAt: true,
          template: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ priorityScore: 'desc' }, { affectedPagesCount: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.fixSuggestion.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        templateName: item.template?.name ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * GET /fixes/:fixSuggestionId
   * Get full fix suggestion with items
   */
  async getFixDetail(userId: string, fixSuggestionId: string) {
    await this.verifyFixAccess(userId, fixSuggestionId);

    const fix = await this.prisma.fixSuggestion.findUnique({
      where: { id: fixSuggestionId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            pageId: true,
            url: true,
            normalizedUrl: true,
            issueId: true,
            perfAuditId: true,
            createdAt: true,
          },
          take: 50,
        },
      },
    });

    if (!fix) {
      throw new NotFoundException('Fix suggestion not found');
    }

    return {
      ...fix,
      templateName: fix.template?.name ?? null,
    };
  }

  /**
   * PATCH /fixes/:fixSuggestionId/status
   * Update fix suggestion status
   */
  async updateFixStatus(
    userId: string,
    fixSuggestionId: string,
    status: FixStatus,
  ) {
    await this.verifyFixAccess(userId, fixSuggestionId);

    const fix = await this.prisma.fixSuggestion.update({
      where: { id: fixSuggestionId },
      data: { status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return fix;
  }

  /**
   * GET /crawls/:crawlRunId/fixes/summary
   * Get summary stats for fix suggestions
   */
  async getFixesSummary(userId: string, crawlRunId: string): Promise<FixesSummary> {
    await this.verifyCrawlAccess(userId, crawlRunId);

    // Get all fixes for this crawl run
    const fixes = await this.prisma.fixSuggestion.findMany({
      where: { crawlRunId },
      select: {
        id: true,
        fixType: true,
        status: true,
        priorityScore: true,
        templateId: true,
        template: {
          select: {
            name: true,
          },
        },
      },
    });

    const total = fixes.length;
    const openCount = fixes.filter((f) => f.status === FixStatus.OPEN).length;
    const inProgressCount = fixes.filter((f) => f.status === FixStatus.IN_PROGRESS).length;
    const doneCount = fixes.filter((f) => f.status === FixStatus.DONE).length;

    // Count regression types
    const regressionTypes: FixType[] = [
      FixType.FIX_LCP_REGRESSION,
      FixType.FIX_CLS_REGRESSION,
      FixType.FIX_INP_REGRESSION,
    ];
    const regressionCount = fixes.filter((f) =>
      regressionTypes.includes(f.fixType),
    ).length;

    // Count critical (high priority) fixes - priorityScore > 15
    const criticalCount = fixes.filter(
      (f) => f.priorityScore && f.priorityScore > 15,
    ).length;

    // Group by fix type
    const fixTypeMap = new Map<FixType, number>();
    for (const fix of fixes) {
      fixTypeMap.set(fix.fixType, (fixTypeMap.get(fix.fixType) ?? 0) + 1);
    }
    const topFixTypes = Array.from(fixTypeMap.entries())
      .map(([fixType, count]) => ({ fixType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Group by template
    const templateMap = new Map<
      string | null,
      { templateName: string | null; count: number }
    >();
    for (const fix of fixes) {
      const key = fix.templateId ?? null;
      const existing = templateMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        templateMap.set(key, {
          templateName: fix.template?.name ?? null,
          count: 1,
        });
      }
    }
    const byTemplate = Array.from(templateMap.entries())
      .map(([templateId, data]) => ({
        templateId,
        templateName: data.templateName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      openCount,
      inProgressCount,
      doneCount,
      criticalCount,
      regressionCount,
      topFixTypes,
      byTemplate,
    };
  }

  /**
   * GET /crawls/:crawlRunId/fixes/export.csv
   * Export fixes as CSV
   */
  async exportFixesCsv(userId: string, crawlRunId: string): Promise<string> {
    await this.verifyCrawlAccess(userId, crawlRunId);

    const fixes = await this.prisma.fixSuggestion.findMany({
      where: { crawlRunId },
      include: {
        template: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            url: true,
          },
          take: 5,
        },
      },
      orderBy: [{ priorityScore: 'desc' }],
    });

    const headers = [
      'ID',
      'Priority Score',
      'Impact Score',
      'Effort Score',
      'Title',
      'Fix Type',
      'Status',
      'Template',
      'Affected Pages',
      'Summary',
      'Recommendation',
      'Example URLs',
    ];

    const rows = fixes.map((fix) => [
      fix.id,
      fix.priorityScore?.toString() ?? '',
      fix.impactScore?.toString() ?? '',
      fix.effortScore?.toString() ?? '',
      `"${fix.title.replace(/"/g, '""')}"`,
      fix.fixType,
      fix.status,
      fix.template?.name ?? 'Global',
      fix.affectedPagesCount.toString(),
      `"${fix.summary.replace(/"/g, '""')}"`,
      `"${fix.recommendation.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${fix.items.map((i) => i.url).join('; ')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * GET /crawls/:crawlRunId/fixpack.md
   * Generate markdown fix pack
   */
  async generateFixPack(userId: string, crawlRunId: string): Promise<string> {
    const crawlRun = await this.verifyCrawlAccess(userId, crawlRunId);

    const fixes = await this.prisma.fixSuggestion.findMany({
      where: { crawlRunId },
      include: {
        template: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            url: true,
          },
          take: 5,
        },
      },
      orderBy: [{ priorityScore: 'desc' }],
      take: 10,
    });

    const project = await this.prisma.project.findUnique({
      where: { id: crawlRun.projectId },
      select: { name: true, domain: true },
    });

    const lines: string[] = [];

    lines.push(`# Fix Pack: ${project?.name ?? 'Unknown Project'}`);
    lines.push('');
    lines.push(`**Domain:** ${project?.domain ?? 'N/A'}`);
    lines.push(`**Crawl Run ID:** ${crawlRunId}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Top 10 Priority Fixes');
    lines.push('');

    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      lines.push(`### ${i + 1}. ${fix.title}`);
      lines.push('');
      lines.push(`**Priority Score:** ${fix.priorityScore?.toFixed(2) ?? 'N/A'} | **Impact:** ${fix.impactScore?.toFixed(1) ?? 'N/A'}/10 | **Effort:** ${fix.effortScore ?? 'N/A'}/10`);
      lines.push('');
      lines.push(`**Type:** \`${fix.fixType}\` | **Status:** ${fix.status}`);
      lines.push('');
      lines.push(`**Template:** ${fix.template?.name ?? 'Global (all pages)'}`);
      lines.push('');
      lines.push(`**Affected Pages:** ${fix.affectedPagesCount}`);
      lines.push('');
      lines.push('#### Summary');
      lines.push('');
      lines.push(fix.summary);
      lines.push('');
      lines.push('#### Recommended Steps');
      lines.push('');
      lines.push(fix.recommendation);
      lines.push('');

      if (fix.items.length > 0) {
        lines.push('#### Example URLs');
        lines.push('');
        for (const item of fix.items) {
          lines.push(`- ${item.url}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    lines.push('## Status Legend');
    lines.push('');
    lines.push('- **OPEN**: Not yet started');
    lines.push('- **IN_PROGRESS**: Currently being worked on');
    lines.push('- **DONE**: Completed');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Generated by Hydra Frog OS*');

    const content = lines.join('\n');

    // Save to storage
    const fixPackDir = path.join(process.cwd(), '..', '..', 'storage', 'fixpacks');
    if (!fs.existsSync(fixPackDir)) {
      fs.mkdirSync(fixPackDir, { recursive: true });
    }
    const filePath = path.join(fixPackDir, `${crawlRunId}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');

    return content;
  }
}
