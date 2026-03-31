import { FixType } from '@prisma/client';
import { computeFixScores, explainPriorityScore } from './scoreFixSuggestions.js';

describe('computeFixScores', () => {
  describe('impactScore', () => {
    it('should give highest impact to CRITICAL severity', () => {
      const scores = computeFixScores({
        severity: 'CRITICAL',
        fixType: FixType.FIX_404_PAGES,
        affectedPagesCount: 10,
      });
      expect(scores.impactScore).toBe(9);
    });

    it('should give HIGH severity score of 7', () => {
      const scores = computeFixScores({
        severity: 'HIGH',
        fixType: FixType.FIX_MISSING_TITLES,
        affectedPagesCount: 10,
      });
      expect(scores.impactScore).toBe(7);
    });

    it('should give MEDIUM severity score of 5', () => {
      const scores = computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_META_DESCRIPTIONS,
        affectedPagesCount: 10,
      });
      expect(scores.impactScore).toBe(5);
    });

    it('should give LOW severity score of 2', () => {
      const scores = computeFixScores({
        severity: 'LOW',
        fixType: FixType.FIX_H1_ISSUES,
        affectedPagesCount: 10,
      });
      expect(scores.impactScore).toBe(2);
    });

    it('should add +2 bonus for performance regressions', () => {
      const scores = computeFixScores({
        severity: 'HIGH',
        fixType: FixType.FIX_LCP_REGRESSION,
        affectedPagesCount: 10,
        isRegression: true,
      });
      expect(scores.impactScore).toBe(9); // 7 + 2
    });

    it('should cap impact at 10 for CRITICAL regressions', () => {
      const scores = computeFixScores({
        severity: 'CRITICAL',
        fixType: FixType.FIX_CLS_REGRESSION,
        affectedPagesCount: 10,
        isRegression: true,
      });
      expect(scores.impactScore).toBe(10); // 9 + 2 = 11, capped at 10
    });
  });

  describe('scaleScore', () => {
    it('should give score of 2 for 1-5 affected pages', () => {
      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 1,
      }).scaleScore).toBe(2);

      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 5,
      }).scaleScore).toBe(2);
    });

    it('should give score of 5 for 6-50 affected pages', () => {
      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 6,
      }).scaleScore).toBe(5);

      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 50,
      }).scaleScore).toBe(5);
    });

    it('should give score of 7 for 51-300 affected pages', () => {
      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 51,
      }).scaleScore).toBe(7);

      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 299,
      }).scaleScore).toBe(7);
    });

    it('should give score of 10 for 300+ affected pages', () => {
      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 300,
      }).scaleScore).toBe(10);

      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 1000,
      }).scaleScore).toBe(10);
    });

    it('should give score of 0 for 0 affected pages', () => {
      expect(computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_CANONICALS,
        affectedPagesCount: 0,
      }).scaleScore).toBe(0);
    });
  });

  describe('effortScore', () => {
    it('should have lowest effort for FIX_NOINDEX_ACCIDENTAL', () => {
      const scores = computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_NOINDEX_ACCIDENTAL,
        affectedPagesCount: 10,
      });
      expect(scores.effortScore).toBe(2);
    });

    it('should have high effort for FIX_IMAGE_OPTIMIZATION', () => {
      const scores = computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_IMAGE_OPTIMIZATION,
        affectedPagesCount: 10,
      });
      expect(scores.effortScore).toBe(9);
    });

    it('should have medium effort for FIX_REDIRECT_CHAINS', () => {
      const scores = computeFixScores({
        severity: 'MEDIUM',
        fixType: FixType.FIX_REDIRECT_CHAINS,
        affectedPagesCount: 10,
      });
      expect(scores.effortScore).toBe(5);
    });
  });

  describe('priorityScore formula', () => {
    it('should calculate priority as (impact * 1.2 + scale) - (effort * 0.6)', () => {
      // FIX_NOINDEX_ACCIDENTAL with CRITICAL severity and 300+ pages
      // impact = 9, scale = 10, effort = 2
      // priority = (9 * 1.2 + 10) - (2 * 0.6) = 10.8 + 10 - 1.2 = 19.6
      const scores = computeFixScores({
        severity: 'CRITICAL',
        fixType: FixType.FIX_NOINDEX_ACCIDENTAL,
        affectedPagesCount: 500,
      });
      expect(scores.priorityScore).toBe(19.6);
    });

    it('should rank easy high-impact fixes higher than hard low-impact fixes', () => {
      const easyHighImpact = computeFixScores({
        severity: 'CRITICAL',
        fixType: FixType.FIX_NOINDEX_ACCIDENTAL, // effort = 2
        affectedPagesCount: 100,
      });

      const hardLowImpact = computeFixScores({
        severity: 'LOW',
        fixType: FixType.FIX_IMAGE_OPTIMIZATION, // effort = 9
        affectedPagesCount: 5,
      });

      expect(easyHighImpact.priorityScore).toBeGreaterThan(hardLowImpact.priorityScore);
    });

    it('should rank regressions higher due to impact bonus', () => {
      const withRegression = computeFixScores({
        severity: 'HIGH',
        fixType: FixType.FIX_LCP_REGRESSION,
        affectedPagesCount: 50,
        isRegression: true,
      });

      const withoutRegression = computeFixScores({
        severity: 'HIGH',
        fixType: FixType.FIX_LCP_REGRESSION,
        affectedPagesCount: 50,
        isRegression: false,
      });

      expect(withRegression.priorityScore).toBeGreaterThan(withoutRegression.priorityScore);
    });
  });
});

describe('explainPriorityScore', () => {
  it('should explain critical impact correctly', () => {
    const scores = computeFixScores({
      severity: 'CRITICAL',
      fixType: FixType.FIX_404_PAGES,
      affectedPagesCount: 500,
    });
    const explanation = explainPriorityScore(scores);
    expect(explanation).toContain('Critical impact');
    expect(explanation).toContain('affects many pages');
  });

  it('should explain low effort correctly', () => {
    const scores = computeFixScores({
      severity: 'MEDIUM',
      fixType: FixType.FIX_NOINDEX_ACCIDENTAL,
      affectedPagesCount: 10,
    });
    const explanation = explainPriorityScore(scores);
    expect(explanation).toContain('easy to fix');
  });

  it('should explain high effort correctly', () => {
    const scores = computeFixScores({
      severity: 'MEDIUM',
      fixType: FixType.FIX_IMAGE_OPTIMIZATION,
      affectedPagesCount: 10,
    });
    const explanation = explainPriorityScore(scores);
    expect(explanation).toContain('high effort to fix');
  });
});
