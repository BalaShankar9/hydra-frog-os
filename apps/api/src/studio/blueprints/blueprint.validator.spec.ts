/**
 * Blueprint Validator Tests
 */

import {
  validateBlueprintJson,
  isValidBlueprint,
  assertValidBlueprint,
} from './blueprint.validator';
import { createEmptyBlueprint } from './blueprint.schema';

describe('Blueprint Validator', () => {
  describe('validateBlueprintJson', () => {
    it('should validate an empty blueprint created by createEmptyBlueprint', () => {
      const blueprint = createEmptyBlueprint(
        'Test Tool',
        'Test problem description',
        'Expected outcome'
      );

      const result = validateBlueprintJson(blueprint);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null input', () => {
      const result = validateBlueprintJson(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TYPE',
          message: 'Blueprint must be a non-null object',
        })
      );
    });

    it('should reject non-object input', () => {
      const result = validateBlueprintJson('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    describe('required fields', () => {
      it('should require version', () => {
        const result = validateBlueprintJson({
          meta: { title: 'Test', problem: 'P', desiredOutcome: 'O' },
          createdAt: new Date().toISOString(),
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_VERSION' })
        );
      });

      it('should require meta', () => {
        const result = validateBlueprintJson({
          version: '1.0.0',
          createdAt: new Date().toISOString(),
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_META' })
        );
      });

      it('should require createdAt', () => {
        const result = validateBlueprintJson({
          version: '1.0.0',
          meta: { title: 'Test', problem: 'P', desiredOutcome: 'O' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_CREATED_AT' })
        );
      });
    });

    describe('meta validation', () => {
      const validBase = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
      };

      it('should require meta.title', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: { problem: 'P', desiredOutcome: 'O' },
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_TITLE' })
        );
      });

      it('should require meta.problem', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: { title: 'T', desiredOutcome: 'O' },
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_PROBLEM' })
        );
      });

      it('should require meta.desiredOutcome', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: { title: 'T', problem: 'P' },
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_DESIRED_OUTCOME' })
        );
      });

      it('should validate category values', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: {
            title: 'T',
            problem: 'P',
            desiredOutcome: 'O',
            category: 'INVALID_CATEGORY',
          },
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_CATEGORY' })
        );
      });

      it('should accept valid categories', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: {
            title: 'Test',
            problem: 'Problem',
            desiredOutcome: 'Outcome',
            category: 'ANALYTICS',
          },
        });
        expect(result.valid).toBe(true);
      });

      it('should validate complexity range (1-5)', () => {
        const result = validateBlueprintJson({
          ...validBase,
          meta: {
            title: 'T',
            problem: 'P',
            desiredOutcome: 'O',
            complexity: 10,
          },
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_COMPLEXITY' })
        );
      });
    });

    describe('data sources validation', () => {
      const validBase = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        meta: { title: 'T', problem: 'P', desiredOutcome: 'O' },
      };

      it('should validate data source types', () => {
        const result = validateBlueprintJson({
          ...validBase,
          dataSources: [{ type: 'INVALID_SOURCE' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_DATA_SOURCE_TYPE' })
        );
      });

      it('should accept valid data source types', () => {
        const result = validateBlueprintJson({
          ...validBase,
          dataSources: [
            { type: 'PAGES', fields: ['url', 'title'] },
            { type: 'ISSUES' },
          ],
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('inputs validation', () => {
      const validBase = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        meta: { title: 'T', problem: 'P', desiredOutcome: 'O' },
      };

      it('should require input name', () => {
        const result = validateBlueprintJson({
          ...validBase,
          inputs: [{ type: 'TEXT' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_NAME' })
        );
      });

      it('should validate input types', () => {
        const result = validateBlueprintJson({
          ...validBase,
          inputs: [{ name: 'test', type: 'INVALID_TYPE' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_INPUT_TYPE' })
        );
      });

      it('should detect duplicate input names', () => {
        const result = validateBlueprintJson({
          ...validBase,
          inputs: [
            { name: 'duplicate', type: 'TEXT' },
            { name: 'duplicate', type: 'NUMBER' },
          ],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'DUPLICATE_INPUT_NAME' })
        );
      });

      it('should accept valid inputs', () => {
        const result = validateBlueprintJson({
          ...validBase,
          inputs: [
            { name: 'query', type: 'TEXT', label: 'Search Query' },
            { name: 'date', type: 'DATE_RANGE', label: 'Date Range' },
          ],
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('screens validation', () => {
      const validBase = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        meta: { title: 'T', problem: 'P', desiredOutcome: 'O' },
      };

      it('should require screen id', () => {
        const result = validateBlueprintJson({
          ...validBase,
          screens: [{ type: 'RESULTS' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_ID' })
        );
      });

      it('should detect duplicate screen ids', () => {
        const result = validateBlueprintJson({
          ...validBase,
          screens: [
            { id: 'main', type: 'RESULTS' },
            { id: 'main', type: 'DASHBOARD' },
          ],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'DUPLICATE_SCREEN_ID' })
        );
      });

      it('should validate screen types', () => {
        const result = validateBlueprintJson({
          ...validBase,
          screens: [{ id: 's1', type: 'INVALID_SCREEN' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_SCREEN_TYPE' })
        );
      });

      it('should validate component types within screens', () => {
        const result = validateBlueprintJson({
          ...validBase,
          screens: [
            {
              id: 's1',
              type: 'RESULTS',
              components: [{ type: 'INVALID_COMPONENT' }],
            },
          ],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_COMPONENT_TYPE' })
        );
      });
    });

    describe('steps validation', () => {
      const validBase = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        meta: { title: 'T', problem: 'P', desiredOutcome: 'O' },
      };

      it('should require step id', () => {
        const result = validateBlueprintJson({
          ...validBase,
          steps: [{ type: 'FETCH_DATA' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_ID' })
        );
      });

      it('should validate step types', () => {
        const result = validateBlueprintJson({
          ...validBase,
          steps: [{ id: 's1', type: 'INVALID_STEP' }],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'INVALID_STEP_TYPE' })
        );
      });

      it('should detect duplicate step ids', () => {
        const result = validateBlueprintJson({
          ...validBase,
          steps: [
            { id: 'step1', type: 'FETCH_DATA' },
            { id: 'step1', type: 'TRANSFORM' },
          ],
        });
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'DUPLICATE_STEP_ID' })
        );
      });
    });

    describe('strict mode', () => {
      it('should convert warnings to errors in strict mode', () => {
        const blueprint = {
          version: 'invalid-version', // Warning: should be semver
          createdAt: new Date().toISOString(),
          meta: { title: 'T', problem: 'P', desiredOutcome: 'O' },
        };

        // Normal mode: warning only
        const normalResult = validateBlueprintJson(blueprint, false);
        expect(normalResult.valid).toBe(true);
        expect(normalResult.warnings).toHaveLength(1);

        // Strict mode: warnings become errors
        const strictResult = validateBlueprintJson(blueprint, true);
        expect(strictResult.valid).toBe(false);
        expect(strictResult.errors).toHaveLength(1);
      });
    });
  });

  describe('isValidBlueprint', () => {
    it('should return true for valid blueprints', () => {
      const blueprint = createEmptyBlueprint('Test', 'Problem', 'Outcome');
      expect(isValidBlueprint(blueprint)).toBe(true);
    });

    it('should return false for invalid blueprints', () => {
      expect(isValidBlueprint(null)).toBe(false);
      expect(isValidBlueprint({})).toBe(false);
    });
  });

  describe('assertValidBlueprint', () => {
    it('should not throw for valid blueprints', () => {
      const blueprint = createEmptyBlueprint('Test', 'Problem', 'Outcome');
      expect(() => assertValidBlueprint(blueprint)).not.toThrow();
    });

    it('should throw for invalid blueprints', () => {
      expect(() => assertValidBlueprint(null)).toThrow('Invalid blueprint');
      expect(() => assertValidBlueprint({})).toThrow('Invalid blueprint');
    });

    it('should include error details in thrown message', () => {
      expect(() => assertValidBlueprint({})).toThrow(/version/);
    });
  });

  describe('comprehensive blueprint', () => {
    it('should validate a fully-featured blueprint', () => {
      const blueprint = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        meta: {
          title: 'SEO Health Checker',
          problem: 'Need to identify SEO issues across all pages',
          desiredOutcome: 'A dashboard showing SEO health scores',
          category: 'AUDIT',
          complexity: 3,
          estimatedHours: 40,
          targetUsers: ['Marketing Manager', 'SEO Specialist'],
        },
        dataSources: [
          { type: 'PAGES', fields: ['url', 'title', 'meta', 'headings'] },
          { type: 'ISSUES', filters: { severity: ['ERROR', 'WARNING'] } },
        ],
        inputs: [
          { name: 'projectId', type: 'PROJECT_SELECTOR', label: 'Project', required: true },
          { name: 'dateRange', type: 'DATE_RANGE', label: 'Analysis Period' },
        ],
        outputs: [
          { name: 'healthScore', type: 'METRIC', label: 'Overall Health Score' },
          { name: 'issuesTable', type: 'TABLE', label: 'Issues by Category' },
        ],
        screens: [
          {
            id: 'input-screen',
            type: 'INPUT_FORM',
            title: 'Select Project',
            components: [{ type: 'FORM' }],
          },
          {
            id: 'results-screen',
            type: 'DASHBOARD',
            title: 'SEO Health Dashboard',
            components: [
              { type: 'METRIC_CARD' },
              { type: 'TABLE' },
              { type: 'CHART' },
            ],
          },
        ],
        steps: [
          { id: 'fetch', type: 'FETCH_DATA', order: 1 },
          { id: 'filter', type: 'FILTER', order: 2 },
          { id: 'aggregate', type: 'AGGREGATE', order: 3 },
          { id: 'calculate', type: 'CALCULATE', order: 4 },
        ],
        kpis: [
          {
            id: 'health-score',
            name: 'Health Score',
            calculation: '(passedChecks / totalChecks) * 100',
            unit: '%',
          },
        ],
        risks: [
          {
            description: 'Large sites may timeout',
            severity: 'MEDIUM',
            likelihood: 'POSSIBLE',
            mitigation: 'Implement pagination and caching',
          },
        ],
      };

      const result = validateBlueprintJson(blueprint);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
