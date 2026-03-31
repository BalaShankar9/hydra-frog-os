/**
 * Blueprint Schema - Standard format for ToolSpec blueprints
 * 
 * This defines the structure for marketing tool specifications
 * used in the Marketing Experience Studio.
 */

// ============================================
// CORE BLUEPRINT TYPES
// ============================================

/**
 * Main Blueprint JSON structure stored in ToolSpec.blueprintJson
 */
export interface BlueprintJson {
  /** Schema version for future migrations */
  version: string;
  
  /** Tool metadata */
  meta: BlueprintMeta;
  
  /** Data sources this tool requires */
  dataSources: DataSourceConfig[];
  
  /** Input parameters the tool accepts */
  inputs: InputField[];
  
  /** Output artifacts the tool produces */
  outputs: OutputConfig[];
  
  /** UI screens/components needed */
  screens: ScreenConfig[];
  
  /** Processing steps/pipeline */
  steps: ProcessingStep[];
  
  /** AI prompts for content generation (optional) */
  aiPrompts?: Record<string, AiPromptConfig>;
  
  /** Export formats supported */
  exports: ExportFormat[];
  
  /** KPIs and metrics to track */
  kpis: KpiConfig[];
  
  /** Known risks and mitigations */
  risks: RiskConfig[];
  
  /** Creation context */
  createdFromRequestId?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// META & CONTEXT
// ============================================

export interface BlueprintMeta {
  /** Tool title */
  title: string;
  
  /** Short description */
  description: string;
  
  /** Original problem statement */
  problem: string;
  
  /** Desired outcome */
  desiredOutcome: string;
  
  /** Target user personas */
  targetUsers: string[];
  
  /** Tool category */
  category: ToolCategory;
  
  /** Tags for discovery */
  tags: string[];
  
  /** Estimated complexity (1-5) */
  complexity: number;
  
  /** Estimated build time in hours */
  estimatedHours: number;
}

export type ToolCategory = 
  | 'ANALYTICS'      // Reports, dashboards, metrics
  | 'AUDIT'          // Health checks, compliance
  | 'AUTOMATION'     // Scheduled tasks, workflows
  | 'CALCULATOR'     // ROI, pricing, estimators
  | 'COMPARISON'     // Before/after, A/B
  | 'CONTENT'        // Generators, optimizers
  | 'EXPORT'         // Data exports, reports
  | 'MONITORING'     // Alerts, tracking
  | 'VISUALIZATION'; // Charts, graphs

// ============================================
// DATA SOURCES
// ============================================

export interface DataSourceConfig {
  /** Data source type */
  type: DataSourceType;
  
  /** Whether this source is required */
  required: boolean;
  
  /** Fields to extract from this source */
  fields: string[];
  
  /** Filters to apply */
  filters?: DataFilter[];
  
  /** Aggregations needed */
  aggregations?: AggregationType[];
  
  /** Join conditions with other sources */
  joins?: JoinConfig[];
}

export type DataSourceType = 
  | 'PAGES'          // Crawled pages data
  | 'ISSUES'         // SEO issues
  | 'TEMPLATES'      // Page templates/clusters
  | 'DIFFS'          // Crawl diffs
  | 'PERF_AUDITS'    // Performance audit data
  | 'PERF_BASELINES' // Performance baselines
  | 'REGRESSIONS'    // Performance regressions
  | 'FIXES'          // Fix suggestions
  | 'CRAWL_RUNS'     // Crawl run metadata
  | 'PROJECTS'       // Project settings
  | 'EXTERNAL';      // External API data

export interface DataFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  value: unknown;
}

export type AggregationType = 
  | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' 
  | 'GROUP_BY' | 'DISTINCT' | 'PERCENTILE';

export interface JoinConfig {
  targetSource: DataSourceType;
  localField: string;
  foreignField: string;
  type: 'inner' | 'left' | 'right';
}

// ============================================
// INPUTS & OUTPUTS
// ============================================

export interface InputField {
  /** Field identifier */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Input type */
  type: InputType;
  
  /** Whether required */
  required: boolean;
  
  /** Default value */
  defaultValue?: unknown;
  
  /** Validation rules */
  validation?: ValidationRule[];
  
  /** Help text */
  description?: string;
  
  /** Options for select/multi-select */
  options?: InputOption[];
}

export type InputType = 
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'DATE_RANGE'
  | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX' | 'TOGGLE'
  | 'URL' | 'EMAIL' | 'FILE' | 'COLOR'
  | 'PROJECT_SELECTOR' | 'CRAWL_SELECTOR' | 'TEMPLATE_SELECTOR';

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
}

export interface InputOption {
  value: string;
  label: string;
  description?: string;
}

export interface OutputConfig {
  /** Output identifier */
  name: string;
  
  /** Output type */
  type: OutputType;
  
  /** Data schema/structure */
  schema?: Record<string, unknown>;
  
  /** Description */
  description: string;
}

export type OutputType = 
  | 'TABLE' | 'CHART' | 'METRIC' | 'TEXT' | 'HTML'
  | 'JSON' | 'CSV' | 'PDF' | 'IMAGE' | 'MARKDOWN';

// ============================================
// UI CONFIGURATION
// ============================================

export interface ScreenConfig {
  /** Screen identifier */
  id: string;
  
  /** Screen title */
  title: string;
  
  /** Screen type */
  type: ScreenType;
  
  /** Components on this screen */
  components: ComponentConfig[];
  
  /** Navigation order */
  order: number;
  
  /** Route path segment */
  path?: string;
}

export type ScreenType = 
  | 'INPUT_FORM'     // User inputs/configuration
  | 'RESULTS'        // Output display
  | 'COMPARISON'     // Side-by-side comparison
  | 'DASHBOARD'      // Multiple widgets
  | 'WIZARD'         // Step-by-step flow
  | 'DETAIL';        // Single item detail view

export interface ComponentConfig {
  /** Component identifier */
  id: string;
  
  /** Component type */
  type: ComponentType;
  
  /** Component properties */
  props: Record<string, unknown>;
  
  /** Data binding */
  dataSource?: string;
  
  /** Grid position (row, col, span) */
  layout?: LayoutConfig;
}

export type ComponentType = 
  | 'FORM' | 'TABLE' | 'CHART' | 'CARD' | 'METRIC_CARD'
  | 'PROGRESS_BAR' | 'ALERT' | 'TABS' | 'ACCORDION'
  | 'COMPARISON_TABLE' | 'TIMELINE' | 'HEATMAP'
  | 'GAUGE' | 'SPARKLINE' | 'SUMMARY_STATS';

export interface LayoutConfig {
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
}

// ============================================
// PROCESSING STEPS
// ============================================

export interface ProcessingStep {
  /** Step identifier */
  id: string;
  
  /** Step name */
  name: string;
  
  /** Step type */
  type: StepType;
  
  /** Step order */
  order: number;
  
  /** Step configuration */
  config: Record<string, unknown>;
  
  /** Input from previous steps */
  inputFrom?: string[];
  
  /** Output key */
  outputKey: string;
  
  /** Description */
  description: string;
}

export type StepType = 
  | 'FETCH_DATA'      // Load data from source
  | 'FILTER'          // Filter records
  | 'TRANSFORM'       // Transform/map data
  | 'AGGREGATE'       // Group and aggregate
  | 'CALCULATE'       // Compute metrics
  | 'COMPARE'         // Compare datasets
  | 'RANK'            // Sort/rank items
  | 'AI_ANALYZE'      // AI-powered analysis
  | 'FORMAT'          // Format for output
  | 'EXPORT';         // Generate export file

// ============================================
// AI PROMPTS
// ============================================

export interface AiPromptConfig {
  /** Prompt template */
  template: string;
  
  /** Variables to inject */
  variables: string[];
  
  /** Model to use */
  model?: string;
  
  /** Temperature setting */
  temperature?: number;
  
  /** Max tokens */
  maxTokens?: number;
  
  /** Expected output format */
  outputFormat?: 'text' | 'json' | 'markdown';
}

// ============================================
// EXPORTS
// ============================================

export interface ExportFormat {
  /** Format type */
  type: 'CSV' | 'PDF' | 'EXCEL' | 'JSON' | 'MARKDOWN' | 'HTML' | 'PNG';
  
  /** Format name */
  name: string;
  
  /** Template/configuration */
  template?: string;
  
  /** Fields to include */
  fields?: string[];
}

// ============================================
// KPIs & METRICS
// ============================================

export interface KpiConfig {
  /** KPI identifier */
  id: string;
  
  /** KPI name */
  name: string;
  
  /** Calculation formula/description */
  calculation: string;
  
  /** Data source for this KPI */
  dataSource: string;
  
  /** Unit of measurement */
  unit?: string;
  
  /** Target/goal value */
  target?: number;
  
  /** Threshold for warning/danger */
  thresholds?: ThresholdConfig;
}

export interface ThresholdConfig {
  warning?: number;
  danger?: number;
  direction: 'higher-is-better' | 'lower-is-better';
}

// ============================================
// RISKS
// ============================================

export interface RiskConfig {
  /** Risk identifier */
  id: string;
  
  /** Risk description */
  description: string;
  
  /** Severity level */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  /** Likelihood */
  likelihood: 'RARE' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'CERTAIN';
  
  /** Category */
  category: RiskCategory;
  
  /** Mitigation strategy */
  mitigation: string;
}

export type RiskCategory = 
  | 'DATA_QUALITY'    // Missing/bad data
  | 'PERFORMANCE'     // Slow/resource intensive
  | 'SECURITY'        // Privacy/auth concerns
  | 'UX'              // User experience issues
  | 'ACCURACY'        // Calculation accuracy
  | 'SCALABILITY'     // Large dataset handling
  | 'INTEGRATION';    // External system deps

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a new empty blueprint
 */
export function createEmptyBlueprint(
  title: string,
  problem: string,
  desiredOutcome: string,
  requestId?: string
): BlueprintJson {
  return {
    version: '1.0.0',
    meta: {
      title,
      description: problem,
      problem,
      desiredOutcome,
      targetUsers: [],
      category: 'ANALYTICS',
      tags: [],
      complexity: 3,
      estimatedHours: 8,
    },
    dataSources: [],
    inputs: [],
    outputs: [],
    screens: [],
    steps: [],
    exports: [],
    kpis: [],
    risks: [],
    createdFromRequestId: requestId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate a blueprint structure
 */
export function validateBlueprint(blueprint: BlueprintJson): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!blueprint.version) errors.push('Missing version');
  if (!blueprint.meta?.title) errors.push('Missing meta.title');
  if (!blueprint.meta?.problem) errors.push('Missing meta.problem');
  if (!blueprint.createdAt) errors.push('Missing createdAt');

  return {
    valid: errors.length === 0,
    errors,
  };
}
