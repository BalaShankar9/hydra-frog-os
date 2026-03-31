/**
 * Blueprint Validator
 * 
 * Production-grade validation for ToolSpec blueprintJson
 * Ensures data integrity and schema compliance
 */

import {
  BlueprintJson,
  ToolCategory,
  DataSourceType,
  InputType,
  ScreenType,
  ComponentType,
  StepType,
  OutputType,
} from './blueprint.schema';

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================
// VALID VALUES
// ============================================

const VALID_TOOL_CATEGORIES: ToolCategory[] = [
  'ANALYTICS', 'AUDIT', 'AUTOMATION', 'CALCULATOR', 'COMPARISON',
  'CONTENT', 'EXPORT', 'MONITORING', 'VISUALIZATION',
];

const VALID_DATA_SOURCE_TYPES: DataSourceType[] = [
  'PAGES', 'ISSUES', 'TEMPLATES', 'DIFFS', 'PERF_AUDITS',
  'PERF_BASELINES', 'REGRESSIONS', 'FIXES', 'CRAWL_RUNS',
  'PROJECTS', 'EXTERNAL',
];

const VALID_INPUT_TYPES: InputType[] = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATE_RANGE',
  'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'TOGGLE',
  'URL', 'EMAIL', 'FILE', 'COLOR',
  'PROJECT_SELECTOR', 'CRAWL_SELECTOR', 'TEMPLATE_SELECTOR',
];

const VALID_SCREEN_TYPES: ScreenType[] = [
  'INPUT_FORM', 'RESULTS', 'COMPARISON', 'DASHBOARD', 'WIZARD', 'DETAIL',
];

const VALID_COMPONENT_TYPES: ComponentType[] = [
  'FORM', 'TABLE', 'CHART', 'CARD', 'METRIC_CARD',
  'PROGRESS_BAR', 'ALERT', 'TABS', 'ACCORDION',
  'COMPARISON_TABLE', 'TIMELINE', 'HEATMAP',
  'GAUGE', 'SPARKLINE', 'SUMMARY_STATS',
];

const VALID_STEP_TYPES: StepType[] = [
  'FETCH_DATA', 'FILTER', 'TRANSFORM', 'AGGREGATE',
  'CALCULATE', 'COMPARE', 'RANK', 'AI_ANALYZE',
  'FORMAT', 'EXPORT',
];

const VALID_OUTPUT_TYPES: OutputType[] = [
  'TABLE', 'CHART', 'METRIC', 'TEXT', 'HTML',
  'JSON', 'CSV', 'PDF', 'IMAGE', 'MARKDOWN',
];

// ============================================
// MAIN VALIDATOR
// ============================================

/**
 * Validate a blueprint JSON structure
 * 
 * @param blueprint - The blueprint to validate
 * @param strict - If true, additional warnings become errors
 * @returns Validation result with errors and warnings
 */
export function validateBlueprintJson(
  blueprint: unknown,
  strict = false
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Type guard
  if (!blueprint || typeof blueprint !== 'object') {
    errors.push({
      path: '',
      message: 'Blueprint must be a non-null object',
      code: 'INVALID_TYPE',
    });
    return { valid: false, errors, warnings };
  }

  const bp = blueprint as Record<string, unknown>;

  // ============================================
  // REQUIRED FIELDS
  // ============================================

  // Version
  if (!bp.version || typeof bp.version !== 'string') {
    errors.push({
      path: 'version',
      message: 'version is required and must be a string',
      code: 'MISSING_VERSION',
    });
  } else if (!/^\d+\.\d+\.\d+$/.test(bp.version)) {
    warnings.push({
      path: 'version',
      message: 'version should follow semver format (e.g., "1.0.0")',
      suggestion: 'Use format: MAJOR.MINOR.PATCH',
    });
  }

  // Meta
  if (!bp.meta || typeof bp.meta !== 'object') {
    errors.push({
      path: 'meta',
      message: 'meta is required and must be an object',
      code: 'MISSING_META',
    });
  } else {
    validateMeta(bp.meta as Record<string, unknown>, errors, warnings);
  }

  // CreatedAt
  if (!bp.createdAt || typeof bp.createdAt !== 'string') {
    errors.push({
      path: 'createdAt',
      message: 'createdAt is required and must be a string',
      code: 'MISSING_CREATED_AT',
    });
  } else if (isNaN(Date.parse(bp.createdAt))) {
    errors.push({
      path: 'createdAt',
      message: 'createdAt must be a valid ISO date string',
      code: 'INVALID_DATE',
    });
  }

  // ============================================
  // ARRAYS (with validation)
  // ============================================

  // Data Sources
  if (bp.dataSources !== undefined) {
    if (!Array.isArray(bp.dataSources)) {
      errors.push({
        path: 'dataSources',
        message: 'dataSources must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateDataSources(bp.dataSources, errors, warnings);
    }
  }

  // Inputs
  if (bp.inputs !== undefined) {
    if (!Array.isArray(bp.inputs)) {
      errors.push({
        path: 'inputs',
        message: 'inputs must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateInputs(bp.inputs, errors, warnings);
    }
  }

  // Outputs
  if (bp.outputs !== undefined) {
    if (!Array.isArray(bp.outputs)) {
      errors.push({
        path: 'outputs',
        message: 'outputs must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateOutputs(bp.outputs, errors, warnings);
    }
  }

  // Screens
  if (bp.screens !== undefined) {
    if (!Array.isArray(bp.screens)) {
      errors.push({
        path: 'screens',
        message: 'screens must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateScreens(bp.screens, errors, warnings);
    }
  }

  // Steps
  if (bp.steps !== undefined) {
    if (!Array.isArray(bp.steps)) {
      errors.push({
        path: 'steps',
        message: 'steps must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateSteps(bp.steps, errors, warnings);
    }
  }

  // KPIs
  if (bp.kpis !== undefined) {
    if (!Array.isArray(bp.kpis)) {
      errors.push({
        path: 'kpis',
        message: 'kpis must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateKpis(bp.kpis, errors, warnings);
    }
  }

  // Risks
  if (bp.risks !== undefined) {
    if (!Array.isArray(bp.risks)) {
      errors.push({
        path: 'risks',
        message: 'risks must be an array',
        code: 'INVALID_TYPE',
      });
    } else {
      validateRisks(bp.risks, errors, warnings);
    }
  }

  // Exports
  if (bp.exports !== undefined) {
    if (!Array.isArray(bp.exports)) {
      errors.push({
        path: 'exports',
        message: 'exports must be an array',
        code: 'INVALID_TYPE',
      });
    }
  }

  // ============================================
  // STRICT MODE
  // ============================================

  if (strict) {
    // Convert warnings to errors in strict mode
    for (const warning of warnings) {
      errors.push({
        path: warning.path,
        message: warning.message,
        code: 'STRICT_WARNING',
      });
    }
    warnings.length = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// META VALIDATION
// ============================================

function validateMeta(
  meta: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Required: title
  if (!meta.title || typeof meta.title !== 'string') {
    errors.push({
      path: 'meta.title',
      message: 'meta.title is required and must be a string',
      code: 'MISSING_TITLE',
    });
  } else if (meta.title.length < 3) {
    warnings.push({
      path: 'meta.title',
      message: 'meta.title should be at least 3 characters',
    });
  }

  // Required: problem
  if (!meta.problem || typeof meta.problem !== 'string') {
    errors.push({
      path: 'meta.problem',
      message: 'meta.problem is required and must be a string',
      code: 'MISSING_PROBLEM',
    });
  }

  // Required: desiredOutcome
  if (!meta.desiredOutcome || typeof meta.desiredOutcome !== 'string') {
    errors.push({
      path: 'meta.desiredOutcome',
      message: 'meta.desiredOutcome is required and must be a string',
      code: 'MISSING_DESIRED_OUTCOME',
    });
  }

  // Category validation
  if (meta.category !== undefined) {
    if (!VALID_TOOL_CATEGORIES.includes(meta.category as ToolCategory)) {
      errors.push({
        path: 'meta.category',
        message: `Invalid category. Must be one of: ${VALID_TOOL_CATEGORIES.join(', ')}`,
        code: 'INVALID_CATEGORY',
      });
    }
  }

  // Complexity validation (1-5)
  if (meta.complexity !== undefined) {
    if (typeof meta.complexity !== 'number' || meta.complexity < 1 || meta.complexity > 5) {
      errors.push({
        path: 'meta.complexity',
        message: 'meta.complexity must be a number between 1 and 5',
        code: 'INVALID_COMPLEXITY',
      });
    }
  }

  // Estimated hours validation
  if (meta.estimatedHours !== undefined) {
    if (typeof meta.estimatedHours !== 'number' || meta.estimatedHours < 0) {
      errors.push({
        path: 'meta.estimatedHours',
        message: 'meta.estimatedHours must be a non-negative number',
        code: 'INVALID_ESTIMATED_HOURS',
      });
    }
  }

  // Target users validation
  if (meta.targetUsers !== undefined) {
    if (!Array.isArray(meta.targetUsers)) {
      warnings.push({
        path: 'meta.targetUsers',
        message: 'meta.targetUsers should be an array of strings',
      });
    }
  }
}

// ============================================
// DATA SOURCES VALIDATION
// ============================================

function validateDataSources(
  dataSources: unknown[],
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  dataSources.forEach((ds, i) => {
    if (!ds || typeof ds !== 'object') {
      errors.push({
        path: `dataSources[${i}]`,
        message: 'Data source must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const source = ds as Record<string, unknown>;

    // Type validation
    if (!source.type || !VALID_DATA_SOURCE_TYPES.includes(source.type as DataSourceType)) {
      errors.push({
        path: `dataSources[${i}].type`,
        message: `Invalid data source type. Must be one of: ${VALID_DATA_SOURCE_TYPES.join(', ')}`,
        code: 'INVALID_DATA_SOURCE_TYPE',
      });
    }

    // Fields validation
    if (source.fields !== undefined && !Array.isArray(source.fields)) {
      errors.push({
        path: `dataSources[${i}].fields`,
        message: 'fields must be an array',
        code: 'INVALID_TYPE',
      });
    }
  });
}

// ============================================
// INPUTS VALIDATION
// ============================================

function validateInputs(
  inputs: unknown[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const names = new Set<string>();

  inputs.forEach((input, i) => {
    if (!input || typeof input !== 'object') {
      errors.push({
        path: `inputs[${i}]`,
        message: 'Input must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const inp = input as Record<string, unknown>;

    // Name validation
    if (!inp.name || typeof inp.name !== 'string') {
      errors.push({
        path: `inputs[${i}].name`,
        message: 'input.name is required and must be a string',
        code: 'MISSING_NAME',
      });
    } else {
      // Check for duplicates
      if (names.has(inp.name)) {
        errors.push({
          path: `inputs[${i}].name`,
          message: `Duplicate input name: ${inp.name}`,
          code: 'DUPLICATE_INPUT_NAME',
        });
      }
      names.add(inp.name);
    }

    // Type validation
    if (!inp.type || !VALID_INPUT_TYPES.includes(inp.type as InputType)) {
      errors.push({
        path: `inputs[${i}].type`,
        message: `Invalid input type. Must be one of: ${VALID_INPUT_TYPES.join(', ')}`,
        code: 'INVALID_INPUT_TYPE',
      });
    }

    // Label validation
    if (!inp.label || typeof inp.label !== 'string') {
      warnings.push({
        path: `inputs[${i}].label`,
        message: 'input.label should be provided for better UX',
      });
    }
  });
}

// ============================================
// OUTPUTS VALIDATION
// ============================================

function validateOutputs(
  outputs: unknown[],
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  outputs.forEach((output, i) => {
    if (!output || typeof output !== 'object') {
      errors.push({
        path: `outputs[${i}]`,
        message: 'Output must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const out = output as Record<string, unknown>;

    // Name validation
    if (!out.name || typeof out.name !== 'string') {
      errors.push({
        path: `outputs[${i}].name`,
        message: 'output.name is required',
        code: 'MISSING_NAME',
      });
    }

    // Type validation
    if (out.type && !VALID_OUTPUT_TYPES.includes(out.type as OutputType)) {
      errors.push({
        path: `outputs[${i}].type`,
        message: `Invalid output type. Must be one of: ${VALID_OUTPUT_TYPES.join(', ')}`,
        code: 'INVALID_OUTPUT_TYPE',
      });
    }
  });
}

// ============================================
// SCREENS VALIDATION
// ============================================

function validateScreens(
  screens: unknown[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const ids = new Set<string>();

  screens.forEach((screen, i) => {
    if (!screen || typeof screen !== 'object') {
      errors.push({
        path: `screens[${i}]`,
        message: 'Screen must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const scr = screen as Record<string, unknown>;

    // ID validation
    if (!scr.id || typeof scr.id !== 'string') {
      errors.push({
        path: `screens[${i}].id`,
        message: 'screen.id is required',
        code: 'MISSING_ID',
      });
    } else {
      if (ids.has(scr.id)) {
        errors.push({
          path: `screens[${i}].id`,
          message: `Duplicate screen id: ${scr.id}`,
          code: 'DUPLICATE_SCREEN_ID',
        });
      }
      ids.add(scr.id);
    }

    // Type validation
    if (scr.type && !VALID_SCREEN_TYPES.includes(scr.type as ScreenType)) {
      errors.push({
        path: `screens[${i}].type`,
        message: `Invalid screen type. Must be one of: ${VALID_SCREEN_TYPES.join(', ')}`,
        code: 'INVALID_SCREEN_TYPE',
      });
    }

    // Components validation
    if (scr.components !== undefined) {
      if (!Array.isArray(scr.components)) {
        errors.push({
          path: `screens[${i}].components`,
          message: 'components must be an array',
          code: 'INVALID_TYPE',
        });
      } else {
        validateComponents(scr.components, i, errors, warnings);
      }
    }
  });
}

function validateComponents(
  components: unknown[],
  screenIndex: number,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  components.forEach((comp, j) => {
    if (!comp || typeof comp !== 'object') {
      errors.push({
        path: `screens[${screenIndex}].components[${j}]`,
        message: 'Component must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const c = comp as Record<string, unknown>;

    // Type validation
    if (c.type && !VALID_COMPONENT_TYPES.includes(c.type as ComponentType)) {
      errors.push({
        path: `screens[${screenIndex}].components[${j}].type`,
        message: `Invalid component type. Must be one of: ${VALID_COMPONENT_TYPES.join(', ')}`,
        code: 'INVALID_COMPONENT_TYPE',
      });
    }
  });
}

// ============================================
// STEPS VALIDATION
// ============================================

function validateSteps(
  steps: unknown[],
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  const ids = new Set<string>();

  steps.forEach((step, i) => {
    if (!step || typeof step !== 'object') {
      errors.push({
        path: `steps[${i}]`,
        message: 'Step must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const s = step as Record<string, unknown>;

    // ID validation
    if (!s.id || typeof s.id !== 'string') {
      errors.push({
        path: `steps[${i}].id`,
        message: 'step.id is required',
        code: 'MISSING_ID',
      });
    } else {
      if (ids.has(s.id)) {
        errors.push({
          path: `steps[${i}].id`,
          message: `Duplicate step id: ${s.id}`,
          code: 'DUPLICATE_STEP_ID',
        });
      }
      ids.add(s.id);
    }

    // Type validation
    if (s.type && !VALID_STEP_TYPES.includes(s.type as StepType)) {
      errors.push({
        path: `steps[${i}].type`,
        message: `Invalid step type. Must be one of: ${VALID_STEP_TYPES.join(', ')}`,
        code: 'INVALID_STEP_TYPE',
      });
    }

    // Order validation
    if (s.order !== undefined && typeof s.order !== 'number') {
      errors.push({
        path: `steps[${i}].order`,
        message: 'step.order must be a number',
        code: 'INVALID_TYPE',
      });
    }
  });
}

// ============================================
// KPIS VALIDATION
// ============================================

function validateKpis(
  kpis: unknown[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const ids = new Set<string>();

  kpis.forEach((kpi, i) => {
    if (!kpi || typeof kpi !== 'object') {
      errors.push({
        path: `kpis[${i}]`,
        message: 'KPI must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const k = kpi as Record<string, unknown>;

    // ID validation
    if (!k.id || typeof k.id !== 'string') {
      errors.push({
        path: `kpis[${i}].id`,
        message: 'kpi.id is required',
        code: 'MISSING_ID',
      });
    } else {
      if (ids.has(k.id)) {
        errors.push({
          path: `kpis[${i}].id`,
          message: `Duplicate KPI id: ${k.id}`,
          code: 'DUPLICATE_KPI_ID',
        });
      }
      ids.add(k.id);
    }

    // Name validation
    if (!k.name || typeof k.name !== 'string') {
      warnings.push({
        path: `kpis[${i}].name`,
        message: 'KPI name should be provided',
      });
    }

    // Calculation validation
    if (!k.calculation || typeof k.calculation !== 'string') {
      warnings.push({
        path: `kpis[${i}].calculation`,
        message: 'KPI calculation formula should be documented',
      });
    }
  });
}

// ============================================
// RISKS VALIDATION
// ============================================

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_LIKELIHOODS = ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'CERTAIN'];

function validateRisks(
  risks: unknown[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  risks.forEach((risk, i) => {
    if (!risk || typeof risk !== 'object') {
      errors.push({
        path: `risks[${i}]`,
        message: 'Risk must be an object',
        code: 'INVALID_TYPE',
      });
      return;
    }

    const r = risk as Record<string, unknown>;

    // Severity validation
    if (r.severity && !VALID_SEVERITIES.includes(r.severity as string)) {
      errors.push({
        path: `risks[${i}].severity`,
        message: `Invalid risk severity. Must be one of: ${VALID_SEVERITIES.join(', ')}`,
        code: 'INVALID_SEVERITY',
      });
    }

    // Likelihood validation
    if (r.likelihood && !VALID_LIKELIHOODS.includes(r.likelihood as string)) {
      errors.push({
        path: `risks[${i}].likelihood`,
        message: `Invalid risk likelihood. Must be one of: ${VALID_LIKELIHOODS.join(', ')}`,
        code: 'INVALID_LIKELIHOOD',
      });
    }

    // Mitigation validation
    if (!r.mitigation || typeof r.mitigation !== 'string') {
      warnings.push({
        path: `risks[${i}].mitigation`,
        message: 'Risk mitigation strategy should be documented',
      });
    }
  });
}

// ============================================
// QUICK VALIDATION HELPER
// ============================================

/**
 * Quick validation that just returns true/false
 */
export function isValidBlueprint(blueprint: unknown): boolean {
  return validateBlueprintJson(blueprint).valid;
}

/**
 * Validate and throw on error
 */
export function assertValidBlueprint(blueprint: unknown): asserts blueprint is BlueprintJson {
  const result = validateBlueprintJson(blueprint);
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid blueprint: ${errorMessages}`);
  }
}
