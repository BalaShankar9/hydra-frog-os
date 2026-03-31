import { FixType } from '@prisma/client';

/**
 * Scoring system for FixSuggestions to prioritize the most impactful fixes.
 * 
 * priorityScore = (impactScore * 1.2 + scaleScore) - (effortScore * 0.6)
 */

export interface FixScores {
  impactScore: number;   // 0-10: severity + regression bonus
  scaleScore: number;    // 0-10: based on affected pages count
  effortScore: number;   // 0-10: estimated implementation effort
  priorityScore: number; // final score for sorting
}

export interface ScoreInput {
  severity: string;
  fixType: FixType;
  affectedPagesCount: number;
  isRegression?: boolean;
  templateId?: string | null;
}

/**
 * Impact score based on issue severity (0-10)
 * Higher severity = higher impact
 * Performance regressions get a bonus
 */
function computeImpactScore(severity: string, isRegression: boolean): number {
  const severityScores: Record<string, number> = {
    CRITICAL: 9,
    HIGH: 7,
    MEDIUM: 5,
    LOW: 2,
  };

  let score = severityScores[severity] ?? 4;

  // Performance regressions are particularly impactful for UX/rankings
  if (isRegression) {
    score = Math.min(10, score + 2);
  }

  return score;
}

/**
 * Scale score based on number of affected pages (0-10)
 * More pages affected = more value in fixing
 */
function computeScaleScore(affectedPagesCount: number): number {
  if (affectedPagesCount >= 300) return 10;
  if (affectedPagesCount >= 51) return 7;
  if (affectedPagesCount >= 6) return 5;
  if (affectedPagesCount >= 1) return 2;
  return 0;
}

/**
 * Effort score based on fix type (0-10)
 * Higher effort = harder to implement
 * 
 * Low effort (2-4): Simple config or meta tag changes
 * Medium effort (5-6): Content or redirect work
 * High effort (7-9): Performance optimization requiring dev work
 */
function computeEffortScore(fixType: FixType): number {
  const effortScores: Record<FixType, number> = {
    // Low effort - simple changes
    [FixType.FIX_NOINDEX_ACCIDENTAL]: 2,
    [FixType.FIX_CANONICALS]: 3,
    [FixType.FIX_TITLE_DUPLICATES]: 3,
    [FixType.FIX_MISSING_TITLES]: 4,
    [FixType.FIX_META_DESCRIPTIONS]: 4,
    [FixType.FIX_H1_ISSUES]: 4,
    [FixType.FIX_404_PAGES]: 4,

    // Medium effort - requires content or routing work
    [FixType.FIX_REDIRECT_CHAINS]: 5,
    [FixType.FIX_IMAGE_ALT]: 5,
    [FixType.FIX_CLS_REGRESSION]: 6,

    // High effort - significant dev work
    [FixType.FIX_THIN_CONTENT]: 7,
    [FixType.FIX_LCP_REGRESSION]: 7,
    [FixType.FIX_INP_REGRESSION]: 7,
    [FixType.FIX_RENDER_BLOCKING]: 8,
    [FixType.FIX_UNUSED_JS]: 8,
    [FixType.FIX_IMAGE_OPTIMIZATION]: 9,
  };

  return effortScores[fixType] ?? 5;
}

/**
 * Performance regression fix types
 */
const PERF_REGRESSION_FIX_TYPES: FixType[] = [
  FixType.FIX_LCP_REGRESSION,
  FixType.FIX_CLS_REGRESSION,
  FixType.FIX_INP_REGRESSION,
];

/**
 * Determines if a fix type is a performance regression
 */
function isPerformanceRegression(fixType: FixType): boolean {
  return PERF_REGRESSION_FIX_TYPES.includes(fixType);
}

/**
 * Computes all scores for a FixSuggestion
 * 
 * Formula: priority = (impactScore * 1.2 + scaleScore) - (effortScore * 0.6)
 * 
 * This prioritizes:
 * - High severity issues (CRITICAL/HIGH)
 * - Wide-reaching fixes (many affected pages)
 * - Performance regressions
 * - Low-effort fixes
 */
export function computeFixScores(input: ScoreInput): FixScores {
  const isRegression = input.isRegression ?? isPerformanceRegression(input.fixType);

  const impactScore = computeImpactScore(input.severity, isRegression);
  const scaleScore = computeScaleScore(input.affectedPagesCount);
  const effortScore = computeEffortScore(input.fixType);

  // Priority formula: maximize impact and scale, minimize effort
  // Weights: impact matters most (1.2x), scale adds value, effort reduces priority
  const priorityScore = (impactScore * 1.2 + scaleScore) - (effortScore * 0.6);

  // Round to 2 decimal places for cleaner display
  return {
    impactScore: Math.round(impactScore * 100) / 100,
    scaleScore: Math.round(scaleScore * 100) / 100,
    effortScore: Math.round(effortScore * 100) / 100,
    priorityScore: Math.round(priorityScore * 100) / 100,
  };
}

/**
 * Explains the priority score in human-readable terms
 */
export function explainPriorityScore(scores: FixScores): string {
  const parts: string[] = [];

  if (scores.impactScore >= 8) {
    parts.push('Critical impact');
  } else if (scores.impactScore >= 6) {
    parts.push('High impact');
  } else if (scores.impactScore >= 4) {
    parts.push('Moderate impact');
  } else {
    parts.push('Low impact');
  }

  if (scores.scaleScore >= 8) {
    parts.push('affects many pages');
  } else if (scores.scaleScore >= 5) {
    parts.push('affects moderate number of pages');
  } else {
    parts.push('affects few pages');
  }

  if (scores.effortScore >= 7) {
    parts.push('high effort to fix');
  } else if (scores.effortScore >= 4) {
    parts.push('moderate effort to fix');
  } else {
    parts.push('easy to fix');
  }

  return parts.join(', ');
}
