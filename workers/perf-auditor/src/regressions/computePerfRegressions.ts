/**
 * Compute performance regressions by comparing audits against baselines
 */

import { Prisma, PerfDevice, PerfRegressionSeverity } from '@prisma/client';
import { prisma } from '../prisma.js';

export interface RegressionThresholds {
  scoreDrop: number;      // Score drop threshold (0-1 scale) => MEDIUM
  lcpIncreaseMs: number;  // LCP increase in ms => HIGH
  clsIncrease: number;    // CLS increase (0-1 scale) => HIGH
  inpIncreaseMs: number;  // INP increase in ms => HIGH
  transferIncrease: number; // Transfer size increase in bytes => MEDIUM
}

export const DEFAULT_THRESHOLDS: RegressionThresholds = {
  scoreDrop: 0.05,        // 5 point drop
  lcpIncreaseMs: 800,     // 800ms increase
  clsIncrease: 0.05,      // 0.05 CLS increase
  inpIncreaseMs: 150,     // 150ms increase
  transferIncrease: 512000, // 500KB increase
};

export interface RegressionResult {
  url: string;
  templateId: string | null;
  regressionType: string;
  severity: PerfRegressionSeverity;
  before: number | null;
  after: number | null;
  delta: number;
}

export interface LighthouseMetrics {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  si: number | null;
  tti: number | null;
  tbt: number | null;
  totalRequests: number | null;
  totalTransferSize: number | null;
}

/**
 * Extract metrics from metricsJson
 */
function extractMetrics(metricsJson: unknown): LighthouseMetrics {
  const m = (metricsJson ?? {}) as Record<string, unknown>;
  return {
    lcp: typeof m.lcp === 'number' ? m.lcp : null,
    cls: typeof m.cls === 'number' ? m.cls : null,
    inp: typeof m.inp === 'number' ? m.inp : null,
    fcp: typeof m.fcp === 'number' ? m.fcp : null,
    si: typeof m.si === 'number' ? m.si : null,
    tti: typeof m.tti === 'number' ? m.tti : null,
    tbt: typeof m.tbt === 'number' ? m.tbt : null,
    totalRequests: typeof m.totalRequests === 'number' ? m.totalRequests : null,
    totalTransferSize: typeof m.totalTransferSize === 'number' ? m.totalTransferSize : null,
  };
}

/**
 * Compute regressions between audit metrics and baseline
 */
export function computeRegressionDeltas(
  auditScore: number | null,
  auditMetrics: LighthouseMetrics,
  baselineScore: number | null,
  baselineMetrics: LighthouseMetrics,
  thresholds: RegressionThresholds = DEFAULT_THRESHOLDS,
): RegressionResult[] {
  const results: RegressionResult[] = [];

  // Score regression (drop is bad)
  if (auditScore !== null && baselineScore !== null) {
    const delta = baselineScore - auditScore;
    if (delta >= thresholds.scoreDrop * 100) { // score is 0-100
      results.push({
        url: '',
        templateId: null,
        regressionType: 'SCORE_DROP',
        severity: 'MEDIUM',
        before: baselineScore,
        after: auditScore,
        delta,
      });
    }
  }

  // LCP regression (increase is bad)
  if (auditMetrics.lcp !== null && baselineMetrics.lcp !== null) {
    const delta = auditMetrics.lcp - baselineMetrics.lcp;
    if (delta >= thresholds.lcpIncreaseMs) {
      results.push({
        url: '',
        templateId: null,
        regressionType: 'LCP_INCREASE',
        severity: 'HIGH',
        before: baselineMetrics.lcp,
        after: auditMetrics.lcp,
        delta,
      });
    }
  }

  // CLS regression (increase is bad)
  if (auditMetrics.cls !== null && baselineMetrics.cls !== null) {
    const delta = auditMetrics.cls - baselineMetrics.cls;
    if (delta >= thresholds.clsIncrease) {
      results.push({
        url: '',
        templateId: null,
        regressionType: 'CLS_INCREASE',
        severity: 'HIGH',
        before: baselineMetrics.cls,
        after: auditMetrics.cls,
        delta,
      });
    }
  }

  // INP/TBT regression (increase is bad)
  const auditInp = auditMetrics.inp ?? auditMetrics.tbt;
  const baselineInp = baselineMetrics.inp ?? baselineMetrics.tbt;
  if (auditInp !== null && baselineInp !== null) {
    const delta = auditInp - baselineInp;
    if (delta >= thresholds.inpIncreaseMs) {
      results.push({
        url: '',
        templateId: null,
        regressionType: 'INP_INCREASE',
        severity: 'HIGH',
        before: baselineInp,
        after: auditInp,
        delta,
      });
    }
  }

  // Transfer size regression (increase is bad)
  if (auditMetrics.totalTransferSize !== null && baselineMetrics.totalTransferSize !== null) {
    const delta = auditMetrics.totalTransferSize - baselineMetrics.totalTransferSize;
    if (delta >= thresholds.transferIncrease) {
      results.push({
        url: '',
        templateId: null,
        regressionType: 'TRANSFER_SIZE_INCREASE',
        severity: 'MEDIUM',
        before: baselineMetrics.totalTransferSize,
        after: auditMetrics.totalTransferSize,
        delta,
      });
    }
  }

  return results;
}

/**
 * Compute regressions for all completed perf audits in a crawl run
 */
export async function computePerfRegressions({
  projectId,
  crawlRunId,
  device,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  projectId: string;
  crawlRunId: string;
  device: PerfDevice;
  thresholds?: RegressionThresholds;
}): Promise<{ regressionsCreated: number; baselinesCreated: number }> {
  console.log(`[Regressions] Computing regressions for crawl ${crawlRunId}`);

  // Get all completed audits for this crawl run
  const audits = await prisma.perfAudit.findMany({
    where: {
      crawlRunId,
      device,
      status: 'DONE',
    },
    select: {
      id: true,
      url: true,
      normalizedUrl: true,
      templateId: true,
      score: true,
      metricsJson: true,
    },
  });

  if (audits.length === 0) {
    console.log('[Regressions] No completed audits found');
    return { regressionsCreated: 0, baselinesCreated: 0 };
  }

  let regressionsCreated = 0;
  let baselinesCreated = 0;

  // Process each audit
  for (const audit of audits) {
    const auditMetrics = extractMetrics(audit.metricsJson);

    // Look for existing baseline by template (or by URL if no template)
    let baseline = await prisma.perfBaseline.findFirst({
      where: {
        projectId,
        device,
        templateId: audit.templateId,
      },
    });

    if (!baseline) {
      // Create new baseline from this audit
      const baselineData = {
        score: audit.score,
        metrics: auditMetrics,
        url: audit.url,
        createdFrom: {
          crawlRunId,
          auditId: audit.id,
        },
      };

      await prisma.perfBaseline.create({
        data: {
          projectId,
          device,
          templateId: audit.templateId,
          normalizedUrl: audit.templateId ? null : audit.normalizedUrl,
          baselineJson: baselineData as unknown as Prisma.InputJsonValue,
        },
      });

      baselinesCreated++;
      console.log(`[Regressions] Created baseline for template ${audit.templateId || 'none'}`);
      continue; // No regression to compute for new baseline
    }

    // Extract baseline values
    const baselineJson = baseline.baselineJson as {
      score?: number | null;
      metrics?: LighthouseMetrics;
    };
    const baselineScore = baselineJson.score ?? null;
    const baselineMetrics = extractMetrics(baselineJson.metrics);

    // Compute regressions
    const regressions = computeRegressionDeltas(
      audit.score,
      auditMetrics,
      baselineScore,
      baselineMetrics,
      thresholds,
    );

    // Create regression items
    for (const regression of regressions) {
      await prisma.perfRegressionItem.create({
        data: {
          crawlRunId,
          projectId,
          templateId: audit.templateId,
          url: audit.url,
          type: regression.regressionType,
          severity: regression.severity,
          beforeJson: {
            score: baselineScore,
            metrics: baselineMetrics,
          } as unknown as Prisma.InputJsonValue,
          afterJson: {
            score: audit.score,
            metrics: auditMetrics,
          } as unknown as Prisma.InputJsonValue,
          deltaJson: {
            type: regression.regressionType,
            before: regression.before,
            after: regression.after,
            delta: regression.delta,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      regressionsCreated++;
      console.log(`[Regressions] Created ${regression.regressionType} regression for ${audit.url}`);
    }
  }

  // Update crawl run totals with regression stats
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: { totalsJson: true },
  });

  const currentTotals = (crawlRun?.totalsJson ?? {}) as Record<string, unknown>;

  // Compute additional stats
  const auditScores = audits
    .filter(a => a.score !== null)
    .map(a => a.score as number);
  const avgScore = auditScores.length > 0
    ? Math.round(auditScores.reduce((sum, s) => sum + s, 0) / auditScores.length)
    : null;

  // Get worst templates
  const templateScores = new Map<string, number[]>();
  for (const audit of audits) {
    if (audit.templateId && audit.score !== null) {
      const scores = templateScores.get(audit.templateId) || [];
      scores.push(audit.score);
      templateScores.set(audit.templateId, scores);
    }
  }

  const worstTemplates = Array.from(templateScores.entries())
    .map(([templateId, scores]) => ({
      templateId,
      avgScore: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      totalsJson: {
        ...currentTotals,
        perfRegressionCount: regressionsCreated,
        perfAvgScore: avgScore,
        perfWorstTemplates: worstTemplates,
      },
    },
  });

  console.log(`[Regressions] Complete: ${regressionsCreated} regressions, ${baselinesCreated} baselines`);
  return { regressionsCreated, baselinesCreated };
}

/**
 * Finalize performance results for a crawl run
 * Call this after all perf audits are complete
 */
export async function finalizePerfResults(crawlRunId: string): Promise<{
  regressionsCreated: number;
  baselinesCreated: number;
}> {
  // Get crawl run to determine project and device
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: {
      projectId: true,
      totalsJson: true,
    },
  });

  if (!crawlRun) {
    throw new Error(`CrawlRun ${crawlRunId} not found`);
  }

  const totals = (crawlRun.totalsJson ?? {}) as Record<string, unknown>;
  const device = (totals.perfDevice as PerfDevice) || 'MOBILE';

  return computePerfRegressions({
    projectId: crawlRun.projectId,
    crawlRunId,
    device,
  });
}
