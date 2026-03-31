/**
 * Tests for performance regression detection
 */

import {
  computeRegressionDeltas,
  DEFAULT_THRESHOLDS,
  type LighthouseMetrics,
  type RegressionThresholds,
} from './computePerfRegressions.js';

describe('computeRegressionDeltas', () => {
  const createMetrics = (overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics => ({
    lcp: null,
    cls: null,
    inp: null,
    fcp: null,
    si: null,
    tti: null,
    tbt: null,
    totalRequests: null,
    totalTransferSize: null,
    ...overrides,
  });

  describe('score regressions', () => {
    it('should detect MEDIUM severity for score drop >= 5 points', () => {
      const results = computeRegressionDeltas(
        85, // audit score
        createMetrics(),
        90, // baseline score
        createMetrics(),
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        regressionType: 'SCORE_DROP',
        severity: 'MEDIUM',
        before: 90,
        after: 85,
        delta: 5,
      });
    });

    it('should not flag small score drops', () => {
      const results = computeRegressionDeltas(
        88,
        createMetrics(),
        90,
        createMetrics(),
      );

      expect(results.filter(r => r.regressionType === 'SCORE_DROP')).toHaveLength(0);
    });

    it('should not flag score improvements', () => {
      const results = computeRegressionDeltas(
        95, // better score
        createMetrics(),
        90,
        createMetrics(),
      );

      expect(results.filter(r => r.regressionType === 'SCORE_DROP')).toHaveLength(0);
    });
  });

  describe('LCP regressions', () => {
    it('should detect HIGH severity for LCP increase >= 800ms', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ lcp: 3000 }), // 3000ms
        80,
        createMetrics({ lcp: 2000 }), // was 2000ms
      );

      const lcpRegression = results.find(r => r.regressionType === 'LCP_INCREASE');
      expect(lcpRegression).toBeDefined();
      expect(lcpRegression?.severity).toBe('HIGH');
      expect(lcpRegression?.delta).toBe(1000);
    });

    it('should not flag small LCP increases', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ lcp: 2500 }),
        80,
        createMetrics({ lcp: 2000 }),
      );

      expect(results.filter(r => r.regressionType === 'LCP_INCREASE')).toHaveLength(0);
    });

    it('should not flag LCP improvements', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ lcp: 1500 }), // faster
        80,
        createMetrics({ lcp: 2000 }),
      );

      expect(results.filter(r => r.regressionType === 'LCP_INCREASE')).toHaveLength(0);
    });
  });

  describe('CLS regressions', () => {
    it('should detect HIGH severity for CLS increase >= 0.05', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ cls: 0.15 }),
        80,
        createMetrics({ cls: 0.05 }),
      );

      const clsRegression = results.find(r => r.regressionType === 'CLS_INCREASE');
      expect(clsRegression).toBeDefined();
      expect(clsRegression?.severity).toBe('HIGH');
      expect(clsRegression?.delta).toBeCloseTo(0.1, 5);
    });

    it('should not flag small CLS increases', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ cls: 0.08 }),
        80,
        createMetrics({ cls: 0.05 }),
      );

      expect(results.filter(r => r.regressionType === 'CLS_INCREASE')).toHaveLength(0);
    });
  });

  describe('INP/TBT regressions', () => {
    it('should detect HIGH severity for INP increase >= 150ms', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ inp: 350 }),
        80,
        createMetrics({ inp: 150 }),
      );

      const inpRegression = results.find(r => r.regressionType === 'INP_INCREASE');
      expect(inpRegression).toBeDefined();
      expect(inpRegression?.severity).toBe('HIGH');
      expect(inpRegression?.delta).toBe(200);
    });

    it('should fall back to TBT when INP is null', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ inp: null, tbt: 500 }),
        80,
        createMetrics({ inp: null, tbt: 200 }),
      );

      const inpRegression = results.find(r => r.regressionType === 'INP_INCREASE');
      expect(inpRegression).toBeDefined();
      expect(inpRegression?.delta).toBe(300);
    });
  });

  describe('transfer size regressions', () => {
    it('should detect MEDIUM severity for transfer size increase >= 500KB', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ totalTransferSize: 1500000 }), // 1.5MB
        80,
        createMetrics({ totalTransferSize: 800000 }), // 800KB
      );

      const sizeRegression = results.find(r => r.regressionType === 'TRANSFER_SIZE_INCREASE');
      expect(sizeRegression).toBeDefined();
      expect(sizeRegression?.severity).toBe('MEDIUM');
      expect(sizeRegression?.delta).toBe(700000);
    });

    it('should not flag small transfer size increases', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ totalTransferSize: 1000000 }),
        80,
        createMetrics({ totalTransferSize: 800000 }),
      );

      expect(results.filter(r => r.regressionType === 'TRANSFER_SIZE_INCREASE')).toHaveLength(0);
    });
  });

  describe('multiple regressions', () => {
    it('should detect multiple regressions simultaneously', () => {
      const results = computeRegressionDeltas(
        75,
        createMetrics({ lcp: 4000, cls: 0.2, totalTransferSize: 2000000 }),
        90,
        createMetrics({ lcp: 2000, cls: 0.05, totalTransferSize: 800000 }),
      );

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results.map(r => r.regressionType)).toContain('SCORE_DROP');
      expect(results.map(r => r.regressionType)).toContain('LCP_INCREASE');
      expect(results.map(r => r.regressionType)).toContain('CLS_INCREASE');
      expect(results.map(r => r.regressionType)).toContain('TRANSFER_SIZE_INCREASE');
    });
  });

  describe('null handling', () => {
    it('should handle null metrics gracefully', () => {
      const results = computeRegressionDeltas(
        null,
        createMetrics(),
        null,
        createMetrics(),
      );

      expect(results).toHaveLength(0);
    });

    it('should skip metrics when audit has null but baseline has value', () => {
      const results = computeRegressionDeltas(
        80,
        createMetrics({ lcp: null }),
        80,
        createMetrics({ lcp: 2000 }),
      );

      expect(results.filter(r => r.regressionType === 'LCP_INCREASE')).toHaveLength(0);
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom thresholds', () => {
      const strictThresholds: RegressionThresholds = {
        scoreDrop: 0.02, // 2 points
        lcpIncreaseMs: 100, // 100ms
        clsIncrease: 0.01,
        inpIncreaseMs: 50,
        transferIncrease: 100000, // 100KB
      };

      const results = computeRegressionDeltas(
        88,
        createMetrics({ lcp: 2200 }),
        90,
        createMetrics({ lcp: 2000 }),
        strictThresholds,
      );

      expect(results.find(r => r.regressionType === 'SCORE_DROP')).toBeDefined();
      expect(results.find(r => r.regressionType === 'LCP_INCREASE')).toBeDefined();
    });
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_THRESHOLDS.scoreDrop).toBe(0.05);
    expect(DEFAULT_THRESHOLDS.lcpIncreaseMs).toBe(800);
    expect(DEFAULT_THRESHOLDS.clsIncrease).toBe(0.05);
    expect(DEFAULT_THRESHOLDS.inpIncreaseMs).toBe(150);
    expect(DEFAULT_THRESHOLDS.transferIncrease).toBe(512000);
  });
});
