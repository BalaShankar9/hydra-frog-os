/**
 * AI Suggestion Generator (Rule-Based)
 * 
 * Analyzes a StudioRequest and generates structured suggestions
 * for building marketing tools. Uses keyword matching and heuristics
 * rather than LLM inference.
 */

import type {
  DataSourceType,
  ToolCategory,
  ScreenType,
  ComponentType,
  ExportFormat,
  KpiConfig,
  RiskConfig,
  InputField,
  OutputConfig,
} from '../blueprints/blueprint.schema';

// ============================================
// TYPES
// ============================================

export interface StudioRequestInput {
  id: string;
  title: string;
  problem: string;
  desiredOutcome: string;
  targetUsers: string | null;
  priority: string;
}

export interface SuggestionsOutput {
  /** Suggested tool name (refined from title) */
  suggestedToolName: string;
  
  /** Inferred tool category */
  category: ToolCategory;
  
  /** Must-have features based on request */
  mustHaveFeatures: string[];
  
  /** Nice-to-have features */
  niceToHaveFeatures: string[];
  
  /** Recommended data sources */
  dataSources: DataSourceRecommendation[];
  
  /** Suggested UI screens */
  screens: ScreenRecommendation[];
  
  /** Suggested input fields */
  inputs: InputField[];
  
  /** Suggested outputs */
  outputs: OutputConfig[];
  
  /** Suggested KPIs to track */
  kpis: KpiConfig[];
  
  /** Suggested export formats */
  exports: ExportFormat[];
  
  /** Identified risks */
  risks: RiskConfig[];
  
  /** Estimated complexity (1-5) */
  estimatedComplexity: number;
  
  /** Estimated build hours */
  estimatedHours: number;
  
  /** Suggested tags */
  tags: string[];
  
  /** Confidence score (0-100) */
  confidence: number;
  
  /** Generation metadata */
  generatedAt: string;
  generatorVersion: string;
}

export interface DataSourceRecommendation {
  type: DataSourceType;
  reason: string;
  required: boolean;
  suggestedFields: string[];
}

export interface ScreenRecommendation {
  type: ScreenType;
  title: string;
  components: ComponentType[];
  reason: string;
}

// ============================================
// KEYWORD PATTERNS
// ============================================

const KEYWORD_PATTERNS = {
  // Data source indicators
  dataSources: {
    PAGES: ['pages', 'urls', 'content', 'crawl', 'site', 'website', 'page'],
    ISSUES: ['issues', 'errors', 'problems', 'seo', 'audit', 'health', 'broken'],
    TEMPLATES: ['templates', 'clusters', 'page types', 'categories', 'groups'],
    DIFFS: ['changes', 'diff', 'compare', 'before', 'after', 'delta', 'trends'],
    PERF_AUDITS: ['performance', 'speed', 'lcp', 'cls', 'inp', 'core web vitals', 'lighthouse'],
    PERF_BASELINES: ['baseline', 'benchmark', 'historical', 'trend'],
    REGRESSIONS: ['regression', 'degradation', 'slower', 'worse'],
    FIXES: ['fix', 'recommendation', 'suggestion', 'improve', 'optimize'],
    CRAWL_RUNS: ['crawl', 'scan', 'history', 'runs'],
    PROJECTS: ['project', 'domain', 'site', 'settings'],
  },
  
  // Category indicators
  categories: {
    ANALYTICS: ['report', 'dashboard', 'metrics', 'analytics', 'stats', 'data'],
    AUDIT: ['audit', 'check', 'compliance', 'health', 'score', 'grade'],
    AUTOMATION: ['automate', 'schedule', 'workflow', 'trigger', 'alert'],
    CALCULATOR: ['calculate', 'roi', 'estimate', 'pricing', 'cost', 'value'],
    COMPARISON: ['compare', 'vs', 'versus', 'before after', 'a/b', 'side by side'],
    CONTENT: ['generate', 'write', 'optimize', 'content', 'copy', 'text'],
    EXPORT: ['export', 'download', 'report', 'pdf', 'csv', 'share'],
    MONITORING: ['monitor', 'track', 'alert', 'watch', 'notify'],
    VISUALIZATION: ['chart', 'graph', 'visualize', 'plot', 'diagram'],
  },
  
  // Feature indicators
  features: {
    filtering: ['filter', 'search', 'find', 'query', 'select'],
    sorting: ['sort', 'rank', 'order', 'prioritize', 'top'],
    grouping: ['group', 'cluster', 'category', 'segment'],
    comparison: ['compare', 'diff', 'versus', 'against'],
    export: ['export', 'download', 'share', 'send', 'email'],
    scheduling: ['schedule', 'recurring', 'daily', 'weekly', 'monthly'],
    alerts: ['alert', 'notify', 'warning', 'threshold'],
    scoring: ['score', 'grade', 'rating', 'rank'],
    trending: ['trend', 'over time', 'historical', 'timeline'],
    breakdown: ['breakdown', 'detail', 'drill down', 'by template'],
  },
  
  // Risk indicators
  risks: {
    large_data: ['all pages', 'entire site', 'complete', 'full'],
    real_time: ['real-time', 'live', 'instant', 'immediate'],
    external: ['external', 'api', 'third party', 'integration'],
    sensitive: ['pii', 'personal', 'sensitive', 'private', 'secure'],
    complex: ['complex', 'advanced', 'custom', 'sophisticated'],
  },
};

// ============================================
// SUGGESTION GENERATOR
// ============================================

/**
 * Generate suggestions for a studio request
 */
export function generateSuggestions(request: StudioRequestInput): SuggestionsOutput {
  const combinedText = `${request.title} ${request.problem} ${request.desiredOutcome} ${request.targetUsers || ''}`.toLowerCase();
  
  // Infer category
  const category = inferCategory(combinedText);
  
  // Identify data sources
  const dataSources = identifyDataSources(combinedText);
  
  // Identify features
  const { mustHave, niceToHave } = identifyFeatures(combinedText, request.priority);
  
  // Generate screens
  const screens = generateScreens(category, dataSources, mustHave);
  
  // Generate inputs
  const inputs = generateInputs(category, dataSources, mustHave);
  
  // Generate outputs
  const outputs = generateOutputs(category, dataSources);
  
  // Generate KPIs
  const kpis = generateKpis(category, dataSources, combinedText);
  
  // Generate export formats
  const exports = generateExports(category, combinedText);
  
  // Identify risks
  const risks = identifyRisks(combinedText, dataSources);
  
  // Estimate complexity
  const { complexity, hours } = estimateComplexity(dataSources, screens, mustHave);
  
  // Generate tags
  const tags = generateTags(category, dataSources, mustHave);
  
  // Calculate confidence
  const confidence = calculateConfidence(dataSources, mustHave, combinedText);
  
  // Generate tool name
  const suggestedToolName = generateToolName(request.title, category);
  
  return {
    suggestedToolName,
    category,
    mustHaveFeatures: mustHave,
    niceToHaveFeatures: niceToHave,
    dataSources,
    screens,
    inputs,
    outputs,
    kpis,
    exports,
    risks,
    estimatedComplexity: complexity,
    estimatedHours: hours,
    tags,
    confidence,
    generatedAt: new Date().toISOString(),
    generatorVersion: '1.0.0',
  };
}

// ============================================
// INFERENCE FUNCTIONS
// ============================================

function inferCategory(text: string): ToolCategory {
  const scores: Record<ToolCategory, number> = {
    ANALYTICS: 0,
    AUDIT: 0,
    AUTOMATION: 0,
    CALCULATOR: 0,
    COMPARISON: 0,
    CONTENT: 0,
    EXPORT: 0,
    MONITORING: 0,
    VISUALIZATION: 0,
  };
  
  for (const [category, keywords] of Object.entries(KEYWORD_PATTERNS.categories)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[category as ToolCategory] += 1;
      }
    }
  }
  
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return (sorted[0][1] > 0 ? sorted[0][0] : 'ANALYTICS') as ToolCategory;
}

function identifyDataSources(text: string): DataSourceRecommendation[] {
  const sources: DataSourceRecommendation[] = [];
  
  for (const [sourceType, keywords] of Object.entries(KEYWORD_PATTERNS.dataSources)) {
    const matchedKeywords = keywords.filter(k => text.includes(k));
    if (matchedKeywords.length > 0) {
      sources.push({
        type: sourceType as DataSourceType,
        reason: `Detected keywords: ${matchedKeywords.join(', ')}`,
        required: matchedKeywords.length >= 2,
        suggestedFields: getSuggestedFields(sourceType as DataSourceType),
      });
    }
  }
  
  // Always include PAGES as a baseline if nothing else found
  if (sources.length === 0) {
    sources.push({
      type: 'PAGES',
      reason: 'Default data source for web analysis tools',
      required: true,
      suggestedFields: getSuggestedFields('PAGES'),
    });
  }
  
  return sources;
}

function getSuggestedFields(sourceType: DataSourceType): string[] {
  const fieldMap: Record<DataSourceType, string[]> = {
    PAGES: ['url', 'title', 'statusCode', 'wordCount', 'h1Count', 'canonical'],
    ISSUES: ['type', 'severity', 'pageUrl', 'message', 'templateId'],
    TEMPLATES: ['name', 'pageCount', 'signatureHash', 'samplePageId'],
    DIFFS: ['diffType', 'severity', 'fromValue', 'toValue', 'pageUrl'],
    PERF_AUDITS: ['lcp', 'cls', 'inp', 'performanceScore', 'pageUrl', 'device'],
    PERF_BASELINES: ['metricType', 'p50Value', 'p75Value', 'p90Value'],
    REGRESSIONS: ['metricType', 'severity', 'fromValue', 'toValue'],
    FIXES: ['fixType', 'priorityScore', 'affectedPagesCount', 'status'],
    CRAWL_RUNS: ['status', 'startedAt', 'finishedAt', 'totalsJson'],
    PROJECTS: ['name', 'domain', 'startUrl', 'settingsJson'],
    EXTERNAL: ['endpoint', 'data'],
  };
  return fieldMap[sourceType] || [];
}

function identifyFeatures(text: string, priority: string): { mustHave: string[]; niceToHave: string[] } {
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  
  for (const [feature, keywords] of Object.entries(KEYWORD_PATTERNS.features)) {
    const matchCount = keywords.filter(k => text.includes(k)).length;
    if (matchCount >= 2) {
      mustHave.push(feature);
    } else if (matchCount === 1) {
      niceToHave.push(feature);
    }
  }
  
  // Add baseline features based on priority
  if (priority === 'URGENT' || priority === 'HIGH') {
    if (!mustHave.includes('export')) mustHave.push('export');
  }
  
  // Always have filtering for data tools
  if (!mustHave.includes('filtering')) {
    niceToHave.push('filtering');
  }
  
  return { mustHave, niceToHave };
}

function generateScreens(
  category: ToolCategory,
  dataSources: DataSourceRecommendation[],
  features: string[]
): ScreenRecommendation[] {
  const screens: ScreenRecommendation[] = [];
  
  // Input screen for most tools
  screens.push({
    type: 'INPUT_FORM',
    title: 'Configuration',
    components: ['FORM'],
    reason: 'User input and configuration',
  });
  
  // Category-specific screens
  switch (category) {
    case 'ANALYTICS':
    case 'MONITORING':
      screens.push({
        type: 'DASHBOARD',
        title: 'Dashboard',
        components: ['METRIC_CARD', 'CHART', 'TABLE'],
        reason: 'Overview of key metrics and data',
      });
      break;
      
    case 'AUDIT':
      screens.push({
        type: 'RESULTS',
        title: 'Audit Results',
        components: ['METRIC_CARD', 'GAUGE', 'TABLE', 'ALERT'],
        reason: 'Display audit scores and findings',
      });
      break;
      
    case 'COMPARISON':
      screens.push({
        type: 'COMPARISON',
        title: 'Comparison View',
        components: ['COMPARISON_TABLE', 'CHART'],
        reason: 'Side-by-side comparison of data',
      });
      break;
      
    case 'CALCULATOR':
      screens.push({
        type: 'RESULTS',
        title: 'Results',
        components: ['METRIC_CARD', 'SUMMARY_STATS', 'CHART'],
        reason: 'Display calculation results',
      });
      break;
      
    case 'VISUALIZATION':
      screens.push({
        type: 'DASHBOARD',
        title: 'Visualizations',
        components: ['CHART', 'HEATMAP', 'SPARKLINE'],
        reason: 'Display charts and graphs',
      });
      break;
      
    default:
      screens.push({
        type: 'RESULTS',
        title: 'Results',
        components: ['TABLE', 'METRIC_CARD'],
        reason: 'Display tool output',
      });
  }
  
  // Add detail screen if we have granular data
  if (dataSources.some(d => ['PAGES', 'ISSUES', 'FIXES'].includes(d.type))) {
    screens.push({
      type: 'DETAIL',
      title: 'Item Details',
      components: ['CARD', 'TABLE', 'TIMELINE'],
      reason: 'Drill down into individual items',
    });
  }
  
  // Add trending screen if requested
  if (features.includes('trending')) {
    screens.push({
      type: 'DASHBOARD',
      title: 'Trends',
      components: ['CHART', 'SPARKLINE', 'TIMELINE'],
      reason: 'Historical trends and timeline view',
    });
  }
  
  return screens;
}

function generateInputs(
  category: ToolCategory,
  dataSources: DataSourceRecommendation[],
  features: string[]
): InputField[] {
  const inputs: InputField[] = [];
  
  // Project/Crawl selector (common)
  inputs.push({
    name: 'projectId',
    label: 'Project',
    type: 'PROJECT_SELECTOR',
    required: true,
    description: 'Select the project to analyze',
  });
  
  inputs.push({
    name: 'crawlRunId',
    label: 'Crawl Run',
    type: 'CRAWL_SELECTOR',
    required: true,
    description: 'Select the crawl run to analyze',
  });
  
  // Date range for comparisons/trends
  if (category === 'COMPARISON' || features.includes('trending')) {
    inputs.push({
      name: 'dateRange',
      label: 'Date Range',
      type: 'DATE_RANGE',
      required: false,
      description: 'Filter by date range',
    });
  }
  
  // Template filter if using templates
  if (dataSources.some(d => d.type === 'TEMPLATES')) {
    inputs.push({
      name: 'templateId',
      label: 'Page Template',
      type: 'TEMPLATE_SELECTOR',
      required: false,
      description: 'Filter by page template',
    });
  }
  
  // Filtering inputs
  if (features.includes('filtering')) {
    inputs.push({
      name: 'searchQuery',
      label: 'Search',
      type: 'TEXT',
      required: false,
      description: 'Search URLs or content',
    });
  }
  
  // Category-specific inputs
  switch (category) {
    case 'CALCULATOR':
      inputs.push({
        name: 'targetMetric',
        label: 'Target Metric',
        type: 'SELECT',
        required: true,
        options: [
          { value: 'traffic', label: 'Traffic Impact' },
          { value: 'revenue', label: 'Revenue Impact' },
          { value: 'time_saved', label: 'Time Saved' },
        ],
      });
      break;
      
    case 'COMPARISON':
      inputs.push({
        name: 'baselineCrawlId',
        label: 'Baseline Crawl',
        type: 'CRAWL_SELECTOR',
        required: true,
        description: 'Select the baseline crawl to compare against',
      });
      break;
      
    case 'AUDIT':
      inputs.push({
        name: 'severityFilter',
        label: 'Minimum Severity',
        type: 'SELECT',
        required: false,
        options: [
          { value: 'LOW', label: 'Low and above' },
          { value: 'MEDIUM', label: 'Medium and above' },
          { value: 'HIGH', label: 'High and above' },
          { value: 'CRITICAL', label: 'Critical only' },
        ],
      });
      break;
  }
  
  return inputs;
}

function generateOutputs(
  category: ToolCategory,
  _dataSources: DataSourceRecommendation[]
): OutputConfig[] {
  const outputs: OutputConfig[] = [];
  
  // Summary metrics (common)
  outputs.push({
    name: 'summaryMetrics',
    type: 'METRIC',
    description: 'Key summary metrics and statistics',
  });
  
  // Category-specific outputs
  switch (category) {
    case 'ANALYTICS':
    case 'MONITORING':
      outputs.push({
        name: 'dataTable',
        type: 'TABLE',
        description: 'Detailed data table with all records',
      });
      outputs.push({
        name: 'trendChart',
        type: 'CHART',
        description: 'Trend visualization over time',
      });
      break;
      
    case 'AUDIT':
      outputs.push({
        name: 'auditScore',
        type: 'METRIC',
        description: 'Overall audit score',
      });
      outputs.push({
        name: 'findingsTable',
        type: 'TABLE',
        description: 'List of audit findings',
      });
      break;
      
    case 'COMPARISON':
      outputs.push({
        name: 'diffSummary',
        type: 'TABLE',
        description: 'Summary of differences',
      });
      outputs.push({
        name: 'comparisonChart',
        type: 'CHART',
        description: 'Visual comparison chart',
      });
      break;
      
    case 'CALCULATOR':
      outputs.push({
        name: 'calculationResult',
        type: 'METRIC',
        description: 'Calculated result value',
      });
      outputs.push({
        name: 'breakdownTable',
        type: 'TABLE',
        description: 'Calculation breakdown',
      });
      break;
      
    default:
      outputs.push({
        name: 'resultTable',
        type: 'TABLE',
        description: 'Result data table',
      });
  }
  
  return outputs;
}

function generateKpis(
  category: ToolCategory,
  dataSources: DataSourceRecommendation[],
  text: string
): KpiConfig[] {
  const kpis: KpiConfig[] = [];
  
  // Data source specific KPIs
  if (dataSources.some(d => d.type === 'PAGES')) {
    kpis.push({
      id: 'total_pages',
      name: 'Total Pages',
      calculation: 'COUNT(pages)',
      dataSource: 'PAGES',
      unit: 'pages',
    });
  }
  
  if (dataSources.some(d => d.type === 'ISSUES')) {
    kpis.push({
      id: 'critical_issues',
      name: 'Critical Issues',
      calculation: 'COUNT(issues WHERE severity = CRITICAL)',
      dataSource: 'ISSUES',
      unit: 'issues',
      thresholds: { danger: 1, direction: 'lower-is-better' },
    });
    kpis.push({
      id: 'issue_fix_rate',
      name: 'Fix Rate',
      calculation: '(fixed_issues / total_issues) * 100',
      dataSource: 'ISSUES',
      unit: '%',
      target: 90,
      thresholds: { warning: 70, danger: 50, direction: 'higher-is-better' },
    });
  }
  
  if (dataSources.some(d => d.type === 'PERF_AUDITS')) {
    kpis.push({
      id: 'avg_performance_score',
      name: 'Avg Performance Score',
      calculation: 'AVG(performanceScore)',
      dataSource: 'PERF_AUDITS',
      unit: 'points',
      target: 90,
      thresholds: { warning: 70, danger: 50, direction: 'higher-is-better' },
    });
    kpis.push({
      id: 'pages_passing_cwv',
      name: 'Pages Passing CWV',
      calculation: 'COUNT(pages WHERE lcp <= 2.5 AND cls <= 0.1 AND inp <= 200)',
      dataSource: 'PERF_AUDITS',
      unit: '%',
      target: 75,
    });
  }
  
  if (dataSources.some(d => d.type === 'FIXES')) {
    kpis.push({
      id: 'fixes_completed',
      name: 'Fixes Completed',
      calculation: 'COUNT(fixes WHERE status = DONE)',
      dataSource: 'FIXES',
      unit: 'fixes',
    });
    kpis.push({
      id: 'high_priority_fixes',
      name: 'High Priority Fixes Remaining',
      calculation: 'COUNT(fixes WHERE priorityScore > 15 AND status != DONE)',
      dataSource: 'FIXES',
      unit: 'fixes',
      thresholds: { warning: 5, danger: 10, direction: 'lower-is-better' },
    });
  }
  
  if (dataSources.some(d => d.type === 'DIFFS')) {
    kpis.push({
      id: 'total_changes',
      name: 'Total Changes',
      calculation: 'COUNT(diffs)',
      dataSource: 'DIFFS',
      unit: 'changes',
    });
    kpis.push({
      id: 'critical_changes',
      name: 'Critical Changes',
      calculation: 'COUNT(diffs WHERE severity = CRITICAL)',
      dataSource: 'DIFFS',
      unit: 'changes',
      thresholds: { warning: 5, danger: 10, direction: 'lower-is-better' },
    });
  }
  
  // Category specific KPIs
  if (category === 'AUDIT') {
    kpis.push({
      id: 'audit_score',
      name: 'Audit Score',
      calculation: '100 - (issues_weighted_score / max_score) * 100',
      dataSource: 'ISSUES',
      unit: 'points',
      target: 85,
      thresholds: { warning: 70, danger: 50, direction: 'higher-is-better' },
    });
  }
  
  if (category === 'CALCULATOR' && text.includes('roi')) {
    kpis.push({
      id: 'estimated_roi',
      name: 'Estimated ROI',
      calculation: '(estimated_benefit - estimated_cost) / estimated_cost * 100',
      dataSource: 'CALCULATED',
      unit: '%',
    });
  }
  
  return kpis;
}

function generateExports(category: ToolCategory, text: string): ExportFormat[] {
  const exports: ExportFormat[] = [];
  
  // CSV is always useful
  exports.push({
    type: 'CSV',
    name: 'Data Export (CSV)',
    fields: ['all'],
  });
  
  // PDF for reports
  if (category === 'ANALYTICS' || category === 'AUDIT' || text.includes('report')) {
    exports.push({
      type: 'PDF',
      name: 'PDF Report',
      template: 'standard_report',
    });
  }
  
  // JSON for integrations
  if (text.includes('api') || text.includes('integration')) {
    exports.push({
      type: 'JSON',
      name: 'JSON Export',
    });
  }
  
  // Excel for business users
  if (text.includes('excel') || text.includes('spreadsheet') || category === 'CALCULATOR') {
    exports.push({
      type: 'EXCEL',
      name: 'Excel Export',
    });
  }
  
  return exports;
}

function identifyRisks(text: string, dataSources: DataSourceRecommendation[]): RiskConfig[] {
  const risks: RiskConfig[] = [];
  
  // Large data risk
  if (KEYWORD_PATTERNS.risks.large_data.some(k => text.includes(k))) {
    risks.push({
      id: 'large_dataset',
      description: 'Processing large datasets may cause performance issues',
      severity: 'MEDIUM',
      likelihood: 'LIKELY',
      category: 'PERFORMANCE',
      mitigation: 'Implement pagination, caching, and progress indicators',
    });
  }
  
  // Real-time risk
  if (KEYWORD_PATTERNS.risks.real_time.some(k => text.includes(k))) {
    risks.push({
      id: 'real_time_data',
      description: 'Real-time data requirements add complexity',
      severity: 'MEDIUM',
      likelihood: 'POSSIBLE',
      category: 'SCALABILITY',
      mitigation: 'Consider polling intervals or websocket connections',
    });
  }
  
  // External dependency risk
  if (KEYWORD_PATTERNS.risks.external.some(k => text.includes(k)) || 
      dataSources.some(d => d.type === 'EXTERNAL')) {
    risks.push({
      id: 'external_dependency',
      description: 'External API dependencies may cause failures',
      severity: 'HIGH',
      likelihood: 'POSSIBLE',
      category: 'INTEGRATION',
      mitigation: 'Implement retry logic, fallbacks, and graceful degradation',
    });
  }
  
  // Data quality risk
  if (dataSources.length > 2) {
    risks.push({
      id: 'data_quality',
      description: 'Joining multiple data sources may produce inconsistent results',
      severity: 'MEDIUM',
      likelihood: 'POSSIBLE',
      category: 'DATA_QUALITY',
      mitigation: 'Add data validation and consistency checks',
    });
  }
  
  // Complexity risk
  if (KEYWORD_PATTERNS.risks.complex.some(k => text.includes(k))) {
    risks.push({
      id: 'high_complexity',
      description: 'Complex requirements increase development time and bug risk',
      severity: 'MEDIUM',
      likelihood: 'LIKELY',
      category: 'ACCURACY',
      mitigation: 'Break down into phases, add comprehensive testing',
    });
  }
  
  // Performance data accuracy
  if (dataSources.some(d => ['PERF_AUDITS', 'REGRESSIONS'].includes(d.type))) {
    risks.push({
      id: 'perf_accuracy',
      description: 'Performance metrics can vary between measurements',
      severity: 'LOW',
      likelihood: 'CERTAIN',
      category: 'ACCURACY',
      mitigation: 'Use percentiles instead of averages, note measurement conditions',
    });
  }
  
  return risks;
}

function estimateComplexity(
  dataSources: DataSourceRecommendation[],
  screens: ScreenRecommendation[],
  features: string[]
): { complexity: number; hours: number } {
  let complexity = 1;
  let hours = 4;
  
  // Data source complexity
  complexity += Math.min(dataSources.length - 1, 2);
  hours += dataSources.length * 2;
  
  // Screen complexity
  complexity += Math.min(screens.length - 1, 2);
  hours += screens.length * 3;
  
  // Feature complexity
  const complexFeatures = ['comparison', 'trending', 'alerts', 'scheduling'];
  const complexFeatureCount = features.filter(f => complexFeatures.includes(f)).length;
  complexity += complexFeatureCount;
  hours += complexFeatureCount * 4;
  
  // Cap at 5
  complexity = Math.min(Math.max(complexity, 1), 5);
  
  return { complexity, hours };
}

function generateTags(
  category: ToolCategory,
  dataSources: DataSourceRecommendation[],
  features: string[]
): string[] {
  const tags: string[] = [category.toLowerCase()];
  
  // Add data source tags
  for (const ds of dataSources) {
    tags.push(ds.type.toLowerCase().replace('_', '-'));
  }
  
  // Add feature tags
  for (const feature of features) {
    tags.push(feature);
  }
  
  return [...new Set(tags)];
}

function calculateConfidence(
  dataSources: DataSourceRecommendation[],
  features: string[],
  text: string
): number {
  let confidence = 50;
  
  // More data sources = more confidence in understanding
  confidence += Math.min(dataSources.length * 10, 20);
  
  // More features = more confidence
  confidence += Math.min(features.length * 5, 15);
  
  // Longer description = more context
  if (text.length > 200) confidence += 10;
  if (text.length > 500) confidence += 5;
  
  return Math.min(confidence, 95);
}

function generateToolName(title: string, category: ToolCategory): string {
  // Clean up the title
  let name = title.trim();
  
  // Remove common prefixes
  name = name.replace(/^(create|build|make|implement|add)\s+/i, '');
  
  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, l => l.toUpperCase());
  
  // Add category suffix if not present
  const categoryWords: Record<ToolCategory, string[]> = {
    ANALYTICS: ['report', 'dashboard', 'analytics'],
    AUDIT: ['audit', 'checker', 'analyzer'],
    AUTOMATION: ['automation', 'workflow'],
    CALCULATOR: ['calculator', 'estimator'],
    COMPARISON: ['comparison', 'diff', 'compare'],
    CONTENT: ['generator', 'optimizer'],
    EXPORT: ['export', 'report'],
    MONITORING: ['monitor', 'tracker'],
    VISUALIZATION: ['chart', 'graph', 'visualization'],
  };
  
  const hasCategoryWord = categoryWords[category].some(w => 
    name.toLowerCase().includes(w)
  );
  
  if (!hasCategoryWord && name.length < 30) {
    const suffix = categoryWords[category][0];
    name = `${name} ${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`;
  }
  
  return name;
}
