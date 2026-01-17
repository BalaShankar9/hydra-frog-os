import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

/**
 * Issue summary structure for totalsJson
 */
export interface IssueSummary {
  issueCountTotal: number;
  issueCountByType: Record<string, number>;
  issueCountBySeverity: Record<string, number>;
  topIssueTypes: { type: string; count: number }[];
}

/**
 * Compute issue summary statistics for a crawl run.
 */
export async function computeIssueSummary(crawlRunId: string): Promise<IssueSummary> {
  logger.info('Computing issue summary', { crawlRunId });

  // Get all issues for this crawl run
  const issues = await prisma.issue.findMany({
    where: { crawlRunId },
    select: {
      type: true,
      severity: true,
    },
  });

  const issueCountTotal = issues.length;

  // Group by type
  const issueCountByType: Record<string, number> = {};
  for (const issue of issues) {
    issueCountByType[issue.type] = (issueCountByType[issue.type] ?? 0) + 1;
  }

  // Group by severity
  const issueCountBySeverity: Record<string, number> = {};
  for (const issue of issues) {
    issueCountBySeverity[issue.severity] = (issueCountBySeverity[issue.severity] ?? 0) + 1;
  }

  // Top 10 issue types sorted by count descending
  const topIssueTypes = Object.entries(issueCountByType)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const summary: IssueSummary = {
    issueCountTotal,
    issueCountByType,
    issueCountBySeverity,
    topIssueTypes,
  };

  logger.info('Issue summary computed', {
    crawlRunId,
    issueCountTotal,
    typeCount: Object.keys(issueCountByType).length,
  });

  return summary;
}

/**
 * Update CrawlRun.totalsJson with issue summary, merging with existing values.
 */
export async function saveIssueSummary(crawlRunId: string, summary: IssueSummary): Promise<void> {
  // Get existing totalsJson
  const crawlRun = await prisma.crawlRun.findUnique({
    where: { id: crawlRunId },
    select: { totalsJson: true },
  });

  const existingTotals = (crawlRun?.totalsJson as Record<string, unknown>) ?? {};

  // Merge with issue summary
  const updatedTotals = {
    ...existingTotals,
    issueCountTotal: summary.issueCountTotal,
    issueCountByType: summary.issueCountByType,
    issueCountBySeverity: summary.issueCountBySeverity,
    topIssueTypes: summary.topIssueTypes,
  };

  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      totalsJson: JSON.parse(JSON.stringify(updatedTotals)),
    },
  });

  logger.info('Issue summary saved to CrawlRun', { crawlRunId });
}
