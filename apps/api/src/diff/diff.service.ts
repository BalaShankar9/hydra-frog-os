import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { OrgService } from '../org';
import { DiffType, DiffSeverity, Prisma } from '@prisma/client';
import {
  ListDiffItemsQueryDto,
  DiffResponse,
  DiffItemsListResponse,
  CompareResponse,
  DiffSummaryJson,
} from './dto';

@Injectable()
export class DiffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  /**
   * Get the diff for a crawl run (by toRunId)
   */
  async getDiffForCrawlRun(userId: string, toRunId: string): Promise<DiffResponse> {
    // First, get the crawl run to verify access
    const crawlRun = await this.prisma.crawlRun.findUnique({
      where: { id: toRunId },
      include: {
        project: {
          select: { orgId: true },
        },
      },
    });

    if (!crawlRun) {
      throw new NotFoundException('Crawl run not found');
    }

    // Verify user is a member of the org
    await this.orgService.assertOrgMember(userId, crawlRun.project.orgId);

    // Find the diff where toRunId matches
    const diff = await this.prisma.crawlDiff.findFirst({
      where: { toRunId },
    });

    if (!diff) {
      throw new NotFoundException('No diff found for this crawl run');
    }

    return {
      diffId: diff.id,
      projectId: diff.projectId,
      fromRunId: diff.fromRunId,
      toRunId: diff.toRunId,
      createdAt: diff.createdAt,
      summaryJson: diff.summaryJson as DiffSummaryJson | null,
    };
  }

  /**
   * Get a diff by ID
   */
  async getDiffById(userId: string, diffId: string): Promise<DiffResponse> {
    const diff = await this.prisma.crawlDiff.findUnique({
      where: { id: diffId },
      include: {
        project: {
          select: { orgId: true },
        },
      },
    });

    if (!diff) {
      throw new NotFoundException('Diff not found');
    }

    // Verify user is a member of the org
    await this.orgService.assertOrgMember(userId, diff.project.orgId);

    return {
      diffId: diff.id,
      projectId: diff.projectId,
      fromRunId: diff.fromRunId,
      toRunId: diff.toRunId,
      createdAt: diff.createdAt,
      summaryJson: diff.summaryJson as DiffSummaryJson | null,
    };
  }

  /**
   * List diff items with filtering and pagination
   */
  async listDiffItems(
    userId: string,
    diffId: string,
    query: ListDiffItemsQueryDto,
  ): Promise<DiffItemsListResponse> {
    // First verify access to the diff
    const diff = await this.prisma.crawlDiff.findUnique({
      where: { id: diffId },
      include: {
        project: {
          select: { orgId: true },
        },
      },
    });

    if (!diff) {
      throw new NotFoundException('Diff not found');
    }

    await this.orgService.assertOrgMember(userId, diff.project.orgId);

    // Build where clause
    const where: Prisma.CrawlDiffItemWhereInput = {
      diffId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.direction) {
      where.direction = query.direction;
    }

    if (query.q) {
      where.OR = [
        { url: { contains: query.q, mode: 'insensitive' } },
        { normalizedUrl: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    // Execute query
    const [items, total] = await Promise.all([
      this.prisma.crawlDiffItem.findMany({
        where,
        orderBy: [
          // Sort by severity (CRITICAL first) then by type
          { severity: 'desc' },
          { type: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.crawlDiffItem.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        normalizedUrl: item.normalizedUrl,
        url: item.url,
        type: item.type,
        severity: item.severity,
        direction: item.direction,
        beforeJson: item.beforeJson,
        afterJson: item.afterJson,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  /**
   * Compare two crawl runs (compute diff if not exists)
   */
  async compareRuns(
    userId: string,
    projectId: string,
    fromRunId: string,
    toRunId: string,
  ): Promise<CompareResponse> {
    // Verify user has access to the project
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.orgService.assertOrgMember(userId, project.orgId);

    // Verify both runs belong to this project
    const [fromRun, toRun] = await Promise.all([
      this.prisma.crawlRun.findUnique({ where: { id: fromRunId } }),
      this.prisma.crawlRun.findUnique({ where: { id: toRunId } }),
    ]);

    if (!fromRun) {
      throw new NotFoundException('From crawl run not found');
    }

    if (!toRun) {
      throw new NotFoundException('To crawl run not found');
    }

    if (fromRun.projectId !== projectId || toRun.projectId !== projectId) {
      throw new BadRequestException('Both crawl runs must belong to the specified project');
    }

    if (fromRun.status !== 'DONE' || toRun.status !== 'DONE') {
      throw new BadRequestException('Both crawl runs must have status DONE to compare');
    }

    // Check if diff already exists
    const existingDiff = await this.prisma.crawlDiff.findUnique({
      where: {
        fromRunId_toRunId: { fromRunId, toRunId },
      },
    });

    if (existingDiff) {
      return {
        diffId: existingDiff.id,
        summaryJson: existingDiff.summaryJson as DiffSummaryJson | null,
        isNew: false,
      };
    }

    // Compute the diff
    // Note: We compute it inline here since we're in the API
    // In a production scenario, you might want to use a background job
    const diffResult = await this.computeDiff(projectId, fromRunId, toRunId);

    const newDiff = await this.prisma.crawlDiff.findUnique({
      where: { id: diffResult.diffId },
    });

    return {
      diffId: diffResult.diffId,
      summaryJson: newDiff?.summaryJson as DiffSummaryJson | null,
      isNew: true,
    };
  }

  /**
   * Compute diff between two runs (inline implementation for API)
   * This mirrors the worker's computeCrawlDiff but runs synchronously
   */
  private async computeDiff(
    projectId: string,
    fromRunId: string,
    toRunId: string,
  ): Promise<{ diffId: string }> {
    const BATCH_SIZE = 1000;
    const PAGE_FETCH_BATCH = 10000;

    // Fetch pages for both runs
    const fromPages = await this.fetchPagesForRun(fromRunId, PAGE_FETCH_BATCH);
    const toPages = await this.fetchPagesForRun(toRunId, PAGE_FETCH_BATCH);

    // Compute diff items
    const diffItems = this.computeDiffItems(fromPages, toPages);

    // Compute summary
    const summary = this.computeSummary(diffItems);

    // Upsert CrawlDiff
    const diff = await this.prisma.crawlDiff.upsert({
      where: {
        fromRunId_toRunId: { fromRunId, toRunId },
      },
      create: {
        projectId,
        fromRunId,
        toRunId,
        summaryJson: summary as unknown as Prisma.InputJsonValue,
      },
      update: {
        summaryJson: summary as unknown as Prisma.InputJsonValue,
      },
    });

    // Delete existing items (idempotent)
    await this.prisma.crawlDiffItem.deleteMany({
      where: { diffId: diff.id },
    });

    // Insert items in batches
    for (let i = 0; i < diffItems.length; i += BATCH_SIZE) {
      const batch = diffItems.slice(i, i + BATCH_SIZE);
      await this.prisma.crawlDiffItem.createMany({
        data: batch.map((item) => ({
          diffId: diff.id,
          normalizedUrl: item.normalizedUrl,
          url: item.url,
          type: item.type,
          severity: item.severity,
          direction: item.direction,
          beforeJson: item.beforeJson === null ? Prisma.JsonNull : (item.beforeJson as unknown as Prisma.InputJsonValue),
          afterJson: item.afterJson === null ? Prisma.JsonNull : (item.afterJson as unknown as Prisma.InputJsonValue),
        })),
      });
    }

    return { diffId: diff.id };
  }

  private async fetchPagesForRun(
    runId: string,
    batchSize: number,
  ): Promise<Map<string, PageSnapshot>> {
    const pageMap = new Map<string, PageSnapshot>();
    let cursor: string | undefined;

    while (true) {
      const pages = await this.prisma.page.findMany({
        where: { crawlRunId: runId },
        select: {
          id: true,
          normalizedUrl: true,
          url: true,
          statusCode: true,
          title: true,
          metaDescription: true,
          canonical: true,
          robotsMeta: true,
          h1Count: true,
          wordCount: true,
          htmlHash: true,
          redirectChainJson: true,
          templateId: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (pages.length === 0) break;

      for (const page of pages) {
        pageMap.set(page.normalizedUrl, {
          normalizedUrl: page.normalizedUrl,
          url: page.url,
          statusCode: page.statusCode,
          title: page.title,
          metaDescription: page.metaDescription,
          canonical: page.canonical,
          robotsMeta: page.robotsMeta,
          h1Count: page.h1Count,
          wordCount: page.wordCount,
          htmlHash: page.htmlHash,
          redirectChainJson: page.redirectChainJson,
          templateId: page.templateId,
        });
      }

      cursor = pages[pages.length - 1].id;
      if (pages.length < batchSize) break;
    }

    return pageMap;
  }

  private computeDiffItems(
    fromPages: Map<string, PageSnapshot>,
    toPages: Map<string, PageSnapshot>,
  ): DiffItemInput[] {
    const items: DiffItemInput[] = [];
    const allUrls = new Set([...fromPages.keys(), ...toPages.keys()]);

    for (const normalizedUrl of allUrls) {
      const fromPage = fromPages.get(normalizedUrl);
      const toPage = toPages.get(normalizedUrl);

      if (!fromPage && toPage) {
        items.push({
          normalizedUrl,
          url: toPage.url,
          type: DiffType.NEW_URL,
          severity: DiffSeverity.LOW,
          direction: 'IMPROVEMENT',
          beforeJson: null,
          afterJson: toPage,
        });
      } else if (fromPage && !toPage) {
        items.push({
          normalizedUrl,
          url: fromPage.url,
          type: DiffType.REMOVED_URL,
          severity: DiffSeverity.HIGH,
          direction: 'REGRESSION',
          beforeJson: fromPage,
          afterJson: null,
        });
      } else if (fromPage && toPage) {
        const fieldDiffs = this.comparePages(fromPage, toPage);
        items.push(...fieldDiffs);
      }
    }

    return items;
  }

  private comparePages(from: PageSnapshot, to: PageSnapshot): DiffItemInput[] {
    const items: DiffItemInput[] = [];
    const normalizedUrl = from.normalizedUrl;
    const url = to.url;

    // STATUS_CHANGED
    if (from.statusCode !== to.statusCode) {
      const { severity, direction } = this.computeStatusSeverity(from.statusCode, to.statusCode);
      items.push({ normalizedUrl, url, type: DiffType.STATUS_CHANGED, severity, direction, beforeJson: from, afterJson: to });
    }

    // REDIRECT_CHAIN_CHANGED
    if (JSON.stringify(from.redirectChainJson ?? null) !== JSON.stringify(to.redirectChainJson ?? null)) {
      const { severity, direction } = this.computeRedirectChainSeverity(from.redirectChainJson, to.redirectChainJson);
      items.push({ normalizedUrl, url, type: DiffType.REDIRECT_CHAIN_CHANGED, severity, direction, beforeJson: from, afterJson: to });
    }

    // TITLE_CHANGED
    if (from.title !== to.title) {
      const { severity, direction } = this.computeTitleSeverity(from.title, to.title);
      items.push({ normalizedUrl, url, type: DiffType.TITLE_CHANGED, severity, direction, beforeJson: from, afterJson: to });
    }

    // META_DESCRIPTION_CHANGED
    if (from.metaDescription !== to.metaDescription) {
      const { severity, direction } = this.computeMetaDescriptionSeverity(from.metaDescription, to.metaDescription);
      items.push({ normalizedUrl, url, type: DiffType.META_DESCRIPTION_CHANGED, severity, direction, beforeJson: from, afterJson: to });
    }

    // CANONICAL_CHANGED
    if (from.canonical !== to.canonical) {
      items.push({ normalizedUrl, url, type: DiffType.CANONICAL_CHANGED, severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL', beforeJson: from, afterJson: to });
    }

    // ROBOTS_CHANGED
    if (from.robotsMeta !== to.robotsMeta) {
      const { severity, direction } = this.computeRobotsSeverity(from.robotsMeta, to.robotsMeta);
      items.push({ normalizedUrl, url, type: DiffType.ROBOTS_CHANGED, severity, direction, beforeJson: from, afterJson: to });
    }

    // H1_COUNT_CHANGED
    if (from.h1Count !== to.h1Count) {
      items.push({ normalizedUrl, url, type: DiffType.H1_COUNT_CHANGED, severity: DiffSeverity.LOW, direction: 'NEUTRAL', beforeJson: from, afterJson: to });
    }

    // WORDCOUNT_CHANGED
    if (this.isSignificantWordcountChange(from.wordCount, to.wordCount)) {
      items.push({ normalizedUrl, url, type: DiffType.WORDCOUNT_CHANGED, severity: DiffSeverity.LOW, direction: 'NEUTRAL', beforeJson: from, afterJson: to });
    }

    // HTML_HASH_CHANGED
    if (from.htmlHash !== to.htmlHash) {
      items.push({ normalizedUrl, url, type: DiffType.HTML_HASH_CHANGED, severity: DiffSeverity.LOW, direction: 'NEUTRAL', beforeJson: from, afterJson: to });
    }

    // TEMPLATE_CHANGED
    if (from.templateId !== to.templateId) {
      items.push({ normalizedUrl, url, type: DiffType.TEMPLATE_CHANGED, severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL', beforeJson: from, afterJson: to });
    }

    return items;
  }

  private computeStatusSeverity(fromStatus: number | null, toStatus: number | null): { severity: DiffSeverity; direction: Direction } {
    const from = fromStatus ?? 0;
    const to = toStatus ?? 0;
    if (to >= 400 && from < 400) return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
    if (from >= 400 && to < 400) return { severity: DiffSeverity.CRITICAL, direction: 'IMPROVEMENT' };
    return { severity: DiffSeverity.HIGH, direction: 'NEUTRAL' };
  }

  private computeRobotsSeverity(fromRobots: string | null, toRobots: string | null): { severity: DiffSeverity; direction: Direction } {
    const fromHasNoindex = (fromRobots ?? '').toLowerCase().includes('noindex');
    const toHasNoindex = (toRobots ?? '').toLowerCase().includes('noindex');
    if (!fromHasNoindex && toHasNoindex) return { severity: DiffSeverity.CRITICAL, direction: 'REGRESSION' };
    if (fromHasNoindex && !toHasNoindex) return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
    return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
  }

  private computeRedirectChainSeverity(fromChain: unknown, toChain: unknown): { severity: DiffSeverity; direction: Direction } {
    const fromLength = Array.isArray(fromChain) ? fromChain.length : 0;
    const toLength = Array.isArray(toChain) ? toChain.length : 0;
    if (toLength > fromLength) return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
    if (toLength < fromLength) return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
    return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
  }

  private computeTitleSeverity(fromTitle: string | null, toTitle: string | null): { severity: DiffSeverity; direction: Direction } {
    const fromEmpty = !fromTitle || fromTitle.trim() === '';
    const toEmpty = !toTitle || toTitle.trim() === '';
    if (!fromEmpty && toEmpty) return { severity: DiffSeverity.HIGH, direction: 'REGRESSION' };
    if (fromEmpty && !toEmpty) return { severity: DiffSeverity.HIGH, direction: 'IMPROVEMENT' };
    return { severity: DiffSeverity.MEDIUM, direction: 'NEUTRAL' };
  }

  private computeMetaDescriptionSeverity(fromDesc: string | null, toDesc: string | null): { severity: DiffSeverity; direction: Direction } {
    const fromEmpty = !fromDesc || fromDesc.trim() === '';
    const toEmpty = !toDesc || toDesc.trim() === '';
    if (!fromEmpty && toEmpty) return { severity: DiffSeverity.MEDIUM, direction: 'REGRESSION' };
    if (fromEmpty && !toEmpty) return { severity: DiffSeverity.MEDIUM, direction: 'IMPROVEMENT' };
    return { severity: DiffSeverity.LOW, direction: 'NEUTRAL' };
  }

  private isSignificantWordcountChange(fromCount: number | null, toCount: number | null): boolean {
    const from = fromCount ?? 0;
    const to = toCount ?? 0;
    if (from === to) return false;
    const absDiff = Math.abs(to - from);
    if (absDiff >= 200) return true;
    if (from > 0 && absDiff / from >= 0.2) return true;
    if (from === 0 && to > 0) return true;
    return false;
  }

  private computeSummary(items: DiffItemInput[]): DiffSummaryJson {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    let regressions = 0;
    let improvements = 0;
    let neutral = 0;
    const topRegressions: Array<{ normalizedUrl: string; type: string; severity: string }> = [];

    for (const item of items) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;
      if (item.direction === 'REGRESSION') {
        regressions++;
        if (item.severity === DiffSeverity.CRITICAL || item.severity === DiffSeverity.HIGH) {
          topRegressions.push({ normalizedUrl: item.normalizedUrl, type: item.type, severity: item.severity });
        }
      } else if (item.direction === 'IMPROVEMENT') {
        improvements++;
      } else {
        neutral++;
      }
    }

    topRegressions.sort((a, b) => {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    return {
      totalItems: items.length,
      regressions,
      improvements,
      neutral,
      byType,
      bySeverity,
      topRegressions: topRegressions.slice(0, 20),
    };
  }
}

// Types for internal use
type Direction = 'REGRESSION' | 'IMPROVEMENT' | 'NEUTRAL';

interface PageSnapshot {
  normalizedUrl: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1Count: number | null;
  wordCount: number | null;
  htmlHash: string | null;
  redirectChainJson: unknown;
  templateId: string | null;
}

interface DiffItemInput {
  normalizedUrl: string;
  url: string;
  type: DiffType;
  severity: DiffSeverity;
  direction: Direction;
  beforeJson: PageSnapshot | null;
  afterJson: PageSnapshot | null;
}
