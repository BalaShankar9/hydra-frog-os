import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { IssueType, Severity } from '@hydra-frog-os/shared/issues';
import type { IssueSeverity } from '@prisma/client';

/**
 * Evidence for duplicate title issue
 */
interface DuplicateTitleEvidence {
  duplicateTitle: string;
  count: number;
  examples: string[];
}

/**
 * Generate global issues that require analyzing the entire crawl run.
 * Called after BFS crawl and post-processing complete.
 */
export async function generateGlobalIssues(crawlRunId: string): Promise<void> {
  logger.info('Generating global issues', { crawlRunId });

  await detectDuplicateTitles(crawlRunId);

  logger.info('Global issues generation complete', { crawlRunId });
}

/**
 * Detect pages with duplicate titles and create issues for each.
 */
async function detectDuplicateTitles(crawlRunId: string): Promise<void> {
  // Query all pages with non-null, non-empty titles
  const pagesWithTitles = await prisma.page.findMany({
    where: {
      crawlRunId,
      title: {
        not: null,
      },
    },
    select: {
      id: true,
      url: true,
      title: true,
    },
  });

  // Filter out empty titles and group by normalized title (case-insensitive)
  const titleGroups = new Map<string, { id: string; url: string; title: string }[]>();

  for (const page of pagesWithTitles) {
    const title = page.title?.trim();
    if (!title) continue;

    const normalizedTitle = title.toLowerCase();
    const group = titleGroups.get(normalizedTitle) ?? [];
    group.push({ id: page.id, url: page.url, title });
    titleGroups.set(normalizedTitle, group);
  }

  // Find duplicate groups (count >= 2)
  const duplicateGroups = Array.from(titleGroups.entries()).filter(
    ([, pages]) => pages.length >= 2
  );

  if (duplicateGroups.length === 0) {
    logger.debug('No duplicate titles found', { crawlRunId });
    return;
  }

  logger.info('Duplicate title groups found', {
    crawlRunId,
    groupCount: duplicateGroups.length,
  });

  // Create issues for each page in duplicate groups
  const issueData: {
    crawlRunId: string;
    pageId: string;
    type: string;
    severity: IssueSeverity;
    title: string;
    description: string;
    recommendation: string;
    evidenceJson: DuplicateTitleEvidence;
  }[] = [];

  for (const [, pages] of duplicateGroups) {
    // Get top 5 example URLs for evidence
    const exampleUrls = pages.slice(0, 5).map((p) => p.url);
    const originalTitle = pages[0].title; // Use original case from first page

    for (const page of pages) {
      issueData.push({
        crawlRunId,
        pageId: page.id,
        type: IssueType.DUPLICATE_TITLE,
        severity: Severity.MEDIUM as IssueSeverity,
        title: 'Duplicate title',
        description:
          'This page shares the same title with other pages. Duplicate titles can reduce SEO clarity.',
        recommendation: 'Make titles unique and descriptive for each page.',
        evidenceJson: {
          duplicateTitle: originalTitle,
          count: pages.length,
          examples: exampleUrls,
        },
      });
    }
  }

  // Batch insert all duplicate title issues
  if (issueData.length > 0) {
    await prisma.issue.createMany({
      data: issueData.map((issue) => ({
        ...issue,
        evidenceJson: JSON.parse(JSON.stringify(issue.evidenceJson)),
      })),
    });

    logger.info('Duplicate title issues created', {
      crawlRunId,
      issueCount: issueData.length,
      groupCount: duplicateGroups.length,
    });
  }
}
