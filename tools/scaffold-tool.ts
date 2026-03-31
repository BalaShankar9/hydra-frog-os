#!/usr/bin/env npx tsx
/**
 * Tool Scaffolder
 * 
 * Generates starter code for new tools/experiences based on ToolSpec blueprints.
 * 
 * Usage:
 *   pnpm scaffold:tool --spec <toolSpecId>
 *   pnpm scaffold:tool --spec <toolSpecId> --dry-run
 *   pnpm scaffold:tool --spec <toolSpecId> --force
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// Load environment variables from apps/api/.env manually
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const apiEnvPath = path.resolve(__dirname, '../apps/api/.env');
loadEnvFile(apiEnvPath);

// ============================================
// TYPES
// ============================================

interface BlueprintJson {
  title?: string;
  description?: string;
  problem?: string;
  desiredOutcome?: string;
  targetUsers?: string;
  meta?: {
    name?: string;
    version?: string;
    description?: string;
    category?: string;
    tags?: string[];
  };
  dataSources?: Array<{
    type: string;
    alias?: string;
    required?: boolean;
    fields?: string[];
  }>;
  inputs?: Array<{
    name: string;
    label?: string;
    type: string;
    required?: boolean;
    description?: string;
    defaultValue?: unknown;
    options?: Array<{ value: string; label: string }>;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  screens?: Array<{
    type: string;
    title?: string;
    components?: string[];
    description?: string;
  }>;
  steps?: Array<{
    type: string;
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
  }>;
  kpis?: Array<{
    id: string;
    name: string;
    calculation?: string;
    dataSource?: string;
    unit?: string;
    target?: number;
  }>;
  exports?: Array<{
    type: string;
    name?: string;
  }>;
}

interface ToolSpec {
  id: string;
  name: string;
  description: string;
  blueprintJson: BlueprintJson;
  status: string;
  version: string;
}

interface ScaffoldConfig {
  specId: string;
  fromJson: string;
  dryRun: boolean;
  force: boolean;
}

interface GeneratedFile {
  path: string;
  content: string;
}

// ============================================
// CLI ARGS
// ============================================

function parseCliArgs(): ScaffoldConfig {
  const { values } = parseArgs({
    options: {
      spec: { type: 'string', short: 's' },
      'from-json': { type: 'string', short: 'j' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', short: 'f', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Tool Scaffolder - Generate starter code for new tools

Usage:
  pnpm scaffold:tool --spec <toolSpecId>
  pnpm scaffold:tool --from-json <path-to-spec.json>

Options:
  --spec, -s        ToolSpec ID to scaffold from (requires DB connection)
  --from-json, -j   Path to a JSON file containing the ToolSpec
  --dry-run         Preview generated files without writing
  --force, -f       Overwrite existing files
  --help, -h        Show this help message

Example:
  pnpm scaffold:tool --spec clx123abc456
  pnpm scaffold:tool --from-json ./my-tool-spec.json --dry-run
  pnpm scaffold:tool --spec clx123abc456 --force

JSON file format:
  {
    "id": "...",
    "name": "My Tool",
    "description": "Tool description",
    "version": "1.0.0",
    "status": "DRAFT",
    "blueprintJson": { ... }
  }
`);
    process.exit(0);
  }

  if (!values.spec && !values['from-json']) {
    console.error('❌ Error: Either --spec <toolSpecId> or --from-json <path> is required');
    console.error('   Run with --help for usage information');
    process.exit(1);
  }

  return {
    specId: values.spec || '',
    fromJson: values['from-json'] || '',
    dryRun: values['dry-run'] ?? false,
    force: values.force ?? false,
  };
}

// ============================================
// UTILS
// ============================================

/**
 * Convert a string to a safe key (lowercase, alphanumeric, dashes)
 */
function toToolKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Convert a string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a string to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Get root directory of the monorepo
 */
function getMonorepoRoot(): string {
  return path.resolve(__dirname, '..');
}

// ============================================
// TEMPLATE GENERATORS
// ============================================

/**
 * Generate rules module for packages/shared
 */
function generateRulesModule(spec: ToolSpec, toolKey: string): string {
  const blueprint = spec.blueprintJson;
  const pascalName = toPascalCase(toolKey);
  const camelName = toCamelCase(toolKey);

  const dataSources = blueprint.dataSources || [];
  const kpis = blueprint.kpis || [];
  const inputs = blueprint.inputs || [];

  return `/**
 * ${spec.name} - Rules Module
 * 
 * ${spec.description || blueprint.problem || 'Tool rules and business logic'}
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

// ============================================
// TYPES
// ============================================

export interface ${pascalName}Input {
${inputs.map(i => `  /** ${i.description || i.label || i.name} */
  ${i.name}${i.required ? '' : '?'}: ${mapInputType(i.type)};`).join('\n') || '  // Add input fields based on blueprint'}
}

export interface ${pascalName}Output {
  /** Summary metrics */
  summary: ${pascalName}Summary;
  /** Detailed results */
  results: ${pascalName}Result[];
  /** Generated at timestamp */
  generatedAt: string;
}

export interface ${pascalName}Summary {
${kpis.map(k => `  /** ${k.name}${k.unit ? ` (${k.unit})` : ''} */
  ${toCamelCase(k.id)}: number;`).join('\n') || '  totalItems: number;\n  processedItems: number;'}
}

export interface ${pascalName}Result {
  id: string;
  // TODO: Define result fields based on data sources
${dataSources.map(ds => `  // From ${ds.type}: ${(ds.fields || []).join(', ') || 'all fields'}`).join('\n')}
}

// ============================================
// CONSTANTS
// ============================================

export const ${camelName.toUpperCase()}_CONFIG = {
  /** Tool identifier */
  key: '${toolKey}',
  /** Display name */
  name: '${spec.name}',
  /** Version */
  version: '${spec.version || '1.0.0'}',
  /** Category */
  category: '${blueprint.meta?.category || 'ANALYTICS'}',
} as const;

export const DATA_SOURCES = [
${dataSources.map(ds => `  '${ds.type}',`).join('\n') || "  'PAGES',"}
] as const;

// ============================================
// VALIDATION
// ============================================

/**
 * Validate input parameters
 */
export function validate${pascalName}Input(input: ${pascalName}Input): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

${inputs
  .filter(i => i.required)
  .map(i => `  if (!input.${i.name}) {
    errors.push('${i.label || i.name} is required');
  }`)
  .join('\n\n') || '  // Add validation rules'}

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// CALCULATIONS
// ============================================

${kpis.map(k => `/**
 * Calculate ${k.name}
 * Formula: ${k.calculation || 'custom logic'}
 */
export function calculate${toPascalCase(k.id)}(results: ${pascalName}Result[]): number {
  // TODO: Implement calculation
  // ${k.calculation || 'Define calculation logic'}
  return results.length;
}
`).join('\n') || `/**
 * Calculate summary metrics
 */
export function calculate${pascalName}Summary(results: ${pascalName}Result[]): ${pascalName}Summary {
  return {
    totalItems: results.length,
    processedItems: results.length,
  };
}
`}

// ============================================
// RULES
// ============================================

/**
 * Apply business rules to process data
 */
export function apply${pascalName}Rules(
  input: ${pascalName}Input,
  rawData: unknown[]
): ${pascalName}Result[] {
  // TODO: Implement business logic
  return rawData.map((item, index) => ({
    id: \`result-\${index}\`,
    ...item as object,
  })) as ${pascalName}Result[];
}

/**
 * Generate output from processed results
 */
export function generate${pascalName}Output(
  input: ${pascalName}Input,
  results: ${pascalName}Result[]
): ${pascalName}Output {
  return {
    summary: {
${kpis.map(k => `      ${toCamelCase(k.id)}: calculate${toPascalCase(k.id)}(results),`).join('\n') || '      totalItems: results.length,\n      processedItems: results.length,'}
    },
    results,
    generatedAt: new Date().toISOString(),
  };
}
`;
}

/**
 * Map blueprint input types to TypeScript types
 */
function mapInputType(inputType: string): string {
  const typeMap: Record<string, string> = {
    TEXT: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    SELECT: 'string',
    MULTI_SELECT: 'string[]',
    DATE: 'string',
    DATE_RANGE: '{ start: string; end: string }',
    PROJECT_SELECTOR: 'string',
    CRAWL_SELECTOR: 'string',
    TEMPLATE_SELECTOR: 'string',
    URL_LIST: 'string[]',
    FILE_UPLOAD: 'File',
    JSON: 'Record<string, unknown>',
    SLIDER: 'number',
    TOGGLE: 'boolean',
  };
  return typeMap[inputType] || 'unknown';
}

/**
 * Generate API controller
 */
function generateController(spec: ToolSpec, toolKey: string): string {
  const pascalName = toPascalCase(toolKey);
  const camelName = toCamelCase(toolKey);
  const blueprint = spec.blueprintJson;

  return `/**
 * ${spec.name} - API Controller
 * 
 * ${spec.description || blueprint.problem || 'Tool API endpoints'}
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ${pascalName}Service } from './${toolKey}.service';
import { ${pascalName}Input } from '@hydra-frog/shared/tools/${toolKey}/rules';

@ApiTags('tools/${toolKey}')
@ApiBearerAuth()
@Controller('tools/${toolKey}')
@UseGuards(JwtAuthGuard)
export class ${pascalName}Controller {
  constructor(private readonly ${camelName}Service: ${pascalName}Service) {}

  /**
   * POST /tools/${toolKey}/run
   * Execute the tool with given parameters
   */
  @Post('run')
  @ApiOperation({ summary: 'Run ${spec.name}' })
  @ApiResponse({ status: 200, description: 'Tool execution result' })
  @ApiResponse({ status: 400, description: 'Invalid input parameters' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async run(
    @CurrentUser('id') userId: string,
    @Body() input: ${pascalName}Input,
  ) {
    return this.${camelName}Service.execute(userId, input);
  }

  /**
   * GET /tools/${toolKey}/history
   * Get execution history for a project
   */
  @Get('history')
  @ApiOperation({ summary: 'Get execution history' })
  @ApiQuery({ name: 'projectId', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of previous executions' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId: string,
    @Query('limit') limit?: number,
  ) {
    return this.${camelName}Service.getHistory(userId, projectId, limit ?? 10);
  }

  /**
   * GET /tools/${toolKey}/result/:executionId
   * Get a specific execution result
   */
  @Get('result/:executionId')
  @ApiOperation({ summary: 'Get execution result' })
  @ApiParam({ name: 'executionId', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'Execution result' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getResult(
    @CurrentUser('id') userId: string,
    @Param('executionId') executionId: string,
  ) {
    return this.${camelName}Service.getResult(userId, executionId);
  }

  /**
   * POST /tools/${toolKey}/export
   * Export results in specified format
   */
  @Post('export')
  @ApiOperation({ summary: 'Export results' })
  @ApiResponse({ status: 200, description: 'Exported data' })
  async exportResults(
    @CurrentUser('id') userId: string,
    @Body() body: { executionId: string; format: 'csv' | 'json' | 'pdf' },
  ) {
    return this.${camelName}Service.exportResults(userId, body.executionId, body.format);
  }
}
`;
}

/**
 * Generate API service
 */
function generateService(spec: ToolSpec, toolKey: string): string {
  const pascalName = toPascalCase(toolKey);
  const camelName = toCamelCase(toolKey);
  const blueprint = spec.blueprintJson;
  const dataSources = blueprint.dataSources || [];

  return `/**
 * ${spec.name} - API Service
 * 
 * ${spec.description || blueprint.problem || 'Tool business logic and data access'}
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ${pascalName}Input,
  ${pascalName}Output,
  validate${pascalName}Input,
  apply${pascalName}Rules,
  generate${pascalName}Output,
  ${camelName.toUpperCase()}_CONFIG,
} from '@hydra-frog/shared/tools/${toolKey}/rules';

@Injectable()
export class ${pascalName}Service {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute the tool
   */
  async execute(userId: string, input: ${pascalName}Input): Promise<${pascalName}Output> {
    // Validate input
    const validation = validate${pascalName}Input(input);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // TODO: Verify user has access to project/crawl
    // await this.verifyAccess(userId, input.projectId);

    // Fetch data from sources
    const rawData = await this.fetchData(input);

    // Apply business rules
    const results = apply${pascalName}Rules(input, rawData);

    // Generate output
    const output = generate${pascalName}Output(input, results);

    // TODO: Store execution for history
    // await this.storeExecution(userId, input, output);

    return output;
  }

  /**
   * Fetch data from configured data sources
   */
  private async fetchData(input: ${pascalName}Input): Promise<unknown[]> {
    // TODO: Implement data fetching based on blueprint dataSources
${dataSources.map(ds => `    // ${ds.type}: ${ds.required ? 'Required' : 'Optional'}`).join('\n') || '    // Define data source queries'}

    // Example: Fetch pages
    // const pages = await this.prisma.page.findMany({
    //   where: { crawlRunId: input.crawlRunId },
    //   select: { id: true, url: true, ... },
    // });

    return [];
  }

  /**
   * Get execution history
   */
  async getHistory(userId: string, projectId: string, limit: number) {
    // TODO: Implement history storage and retrieval
    // return this.prisma.toolExecution.findMany({
    //   where: { userId, projectId, toolKey: '${toolKey}' },
    //   orderBy: { createdAt: 'desc' },
    //   take: limit,
    // });
    return [];
  }

  /**
   * Get a specific execution result
   */
  async getResult(userId: string, executionId: string) {
    // TODO: Implement result retrieval
    // const execution = await this.prisma.toolExecution.findUnique({
    //   where: { id: executionId },
    // });
    // if (!execution || execution.userId !== userId) {
    //   throw new NotFoundException('Execution not found');
    // }
    // return execution.resultJson;
    throw new NotFoundException('Execution not found');
  }

  /**
   * Export results in specified format
   */
  async exportResults(
    userId: string,
    executionId: string,
    format: 'csv' | 'json' | 'pdf'
  ) {
    const result = await this.getResult(userId, executionId);

    switch (format) {
      case 'csv':
        return this.exportToCsv(result);
      case 'json':
        return result;
      case 'pdf':
        return this.exportToPdf(result);
      default:
        throw new BadRequestException(\`Unsupported format: \${format}\`);
    }
  }

  private exportToCsv(result: unknown): string {
    // TODO: Implement CSV export
    return '';
  }

  private exportToPdf(result: unknown): Buffer {
    // TODO: Implement PDF export
    return Buffer.from('');
  }
}
`;
}

/**
 * Generate API module
 */
function generateModule(spec: ToolSpec, toolKey: string): string {
  const pascalName = toPascalCase(toolKey);

  return `/**
 * ${spec.name} - API Module
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

import { Module } from '@nestjs/common';
import { ${pascalName}Controller } from './${toolKey}.controller';
import { ${pascalName}Service } from './${toolKey}.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [${pascalName}Controller],
  providers: [${pascalName}Service],
  exports: [${pascalName}Service],
})
export class ${pascalName}Module {}
`;
}

/**
 * Generate Dashboard UI page
 */
function generateDashboardPage(spec: ToolSpec, toolKey: string): string {
  const pascalName = toPascalCase(toolKey);
  const blueprint = spec.blueprintJson;
  const inputs = blueprint.inputs || [];
  const screens = blueprint.screens || [];
  const kpis = blueprint.kpis || [];

  return `'use client';

/**
 * ${spec.name} - Dashboard Page
 * 
 * ${spec.description || blueprint.problem || 'Tool UI'}
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

import { useState } from 'react';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface ${pascalName}Input {
${inputs.map(i => `  ${i.name}${i.required ? '' : '?'}: ${mapInputTypeTS(i.type)};`).join('\n') || '  projectId: string;\n  crawlRunId: string;'}
}

interface ${pascalName}Output {
  summary: Record<string, number>;
  results: Array<Record<string, unknown>>;
  generatedAt: string;
}

// ============================================
// MAIN CONTENT
// ============================================

function ${pascalName}Content() {
  const toast = useToast();
  
  // Input state
  const [input, setInput] = useState<${pascalName}Input>({
${inputs.map(i => `    ${i.name}: ${getDefaultValue(i)},`).join('\n') || '    projectId: \'\',\n    crawlRunId: \'\','}
  });
  
  // Output state
  const [output, setOutput] = useState<${pascalName}Output | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');

  const handleRun = async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch<${pascalName}Output>('/tools/${toolKey}/run', {
        method: 'POST',
        body: input,
      });
      setOutput(result);
      setActiveTab('results');
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Failed to run tool:', err);
      toast.error('Failed to run analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    if (!output) return;
    try {
      // TODO: Implement export with execution ID
      toast.success(\`Exported as \${format.toUpperCase()}\`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">${spec.name}</h1>
          <p className="text-gray-500 mt-1">
            ${spec.description || blueprint.desiredOutcome || 'Analyze your data'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {output && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                📄 CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                🔧 JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('input')}
            className={\`py-3 px-1 border-b-2 font-medium text-sm \${
              activeTab === 'input'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }\`}
          >
            ⚙️ Configuration
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={\`py-3 px-1 border-b-2 font-medium text-sm \${
              activeTab === 'results'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }\`}
          >
            📊 Results {output ? \`(\${output.results.length})\` : ''}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'input' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Input Parameters</h2>
          
          <div className="space-y-4">
${inputs.map(i => generateInputField(i)).join('\n\n') || `            {/* Project Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <input
                type="text"
                value={input.projectId}
                onChange={(e) => setInput({ ...input, projectId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Select project..."
              />
            </div>`}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleRun}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  Running...
                </>
              ) : (
                <>
                  ▶️ Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-6">
          {output ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
${kpis.slice(0, 4).map(k => `                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">${k.name}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {output.summary.${toCamelCase(k.id)} ?? '-'}${k.unit ? ` <span className="text-sm font-normal text-gray-500">${k.unit}</span>` : ''}
                  </p>
                </div>`).join('\n') || `                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {output.summary.totalItems ?? output.results.length}
                  </p>
                </div>`}
              </div>

              {/* Results Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {output.results.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {(row as { id?: string }).id || idx}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <pre className="text-xs">{JSON.stringify(row, null, 2)}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {output.results.length > 50 && (
                  <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                    Showing 50 of {output.results.length} results
                  </div>
                )}
              </div>

              {/* Generated At */}
              <p className="text-sm text-gray-400 text-right">
                Generated at {new Date(output.generatedAt).toLocaleString()}
              </p>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
              <p className="text-gray-500 mb-4">
                Configure your parameters and run the analysis to see results.
              </p>
              <button
                onClick={() => setActiveTab('input')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Go to Configuration
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function ${pascalName}Page() {
  return (
    <Protected>
      <AppShell>
        <${pascalName}Content />
      </AppShell>
    </Protected>
  );
}
`;
}

/**
 * Map input type to TypeScript type for dashboard
 */
function mapInputTypeTS(inputType: string): string {
  const typeMap: Record<string, string> = {
    TEXT: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    SELECT: 'string',
    MULTI_SELECT: 'string[]',
    DATE: 'string',
    DATE_RANGE: '{ start: string; end: string }',
    PROJECT_SELECTOR: 'string',
    CRAWL_SELECTOR: 'string',
    TEMPLATE_SELECTOR: 'string',
    URL_LIST: 'string[]',
    SLIDER: 'number',
    TOGGLE: 'boolean',
  };
  return typeMap[inputType] || 'string';
}

/**
 * Get default value for input
 */
function getDefaultValue(input: { type: string; defaultValue?: unknown }): string {
  if (input.defaultValue !== undefined) {
    return JSON.stringify(input.defaultValue);
  }
  const defaults: Record<string, string> = {
    TEXT: "''",
    NUMBER: '0',
    BOOLEAN: 'false',
    SELECT: "''",
    MULTI_SELECT: '[]',
    DATE: "''",
    DATE_RANGE: "{ start: '', end: '' }",
    PROJECT_SELECTOR: "''",
    CRAWL_SELECTOR: "''",
    TEMPLATE_SELECTOR: "''",
    URL_LIST: '[]',
    SLIDER: '50',
    TOGGLE: 'false',
  };
  return defaults[input.type] || "''";
}

/**
 * Generate input field JSX
 */
function generateInputField(input: {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  description?: string;
  options?: Array<{ value: string; label: string }>;
}): string {
  const label = input.label || input.name;
  const indent = '            ';

  switch (input.type) {
    case 'SELECT':
      return `${indent}{/* ${label} */}
${indent}<div>
${indent}  <label className="block text-sm font-medium text-gray-700 mb-1">
${indent}    ${label}${input.required ? ' *' : ''}
${indent}  </label>
${indent}  <select
${indent}    value={input.${input.name}}
${indent}    onChange={(e) => setInput({ ...input, ${input.name}: e.target.value })}
${indent}    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
${indent}  >
${indent}    <option value="">Select...</option>
${(input.options || []).map(o => `${indent}    <option value="${o.value}">${o.label}</option>`).join('\n')}
${indent}  </select>
${indent}  ${input.description ? `<p className="text-xs text-gray-500 mt-1">${input.description}</p>` : ''}
${indent}</div>`;

    case 'NUMBER':
    case 'SLIDER':
      return `${indent}{/* ${label} */}
${indent}<div>
${indent}  <label className="block text-sm font-medium text-gray-700 mb-1">
${indent}    ${label}${input.required ? ' *' : ''}
${indent}  </label>
${indent}  <input
${indent}    type="number"
${indent}    value={input.${input.name}}
${indent}    onChange={(e) => setInput({ ...input, ${input.name}: Number(e.target.value) })}
${indent}    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
${indent}  />
${indent}  ${input.description ? `<p className="text-xs text-gray-500 mt-1">${input.description}</p>` : ''}
${indent}</div>`;

    case 'BOOLEAN':
    case 'TOGGLE':
      return `${indent}{/* ${label} */}
${indent}<div className="flex items-center gap-3">
${indent}  <input
${indent}    type="checkbox"
${indent}    checked={input.${input.name}}
${indent}    onChange={(e) => setInput({ ...input, ${input.name}: e.target.checked })}
${indent}    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
${indent}  />
${indent}  <label className="text-sm font-medium text-gray-700">
${indent}    ${label}
${indent}  </label>
${indent}  ${input.description ? `<span className="text-xs text-gray-500">${input.description}</span>` : ''}
${indent}</div>`;

    default: // TEXT and others
      return `${indent}{/* ${label} */}
${indent}<div>
${indent}  <label className="block text-sm font-medium text-gray-700 mb-1">
${indent}    ${label}${input.required ? ' *' : ''}
${indent}  </label>
${indent}  <input
${indent}    type="text"
${indent}    value={input.${input.name}}
${indent}    onChange={(e) => setInput({ ...input, ${input.name}: e.target.value })}
${indent}    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
${indent}    placeholder="${input.description || `Enter ${label.toLowerCase()}...`}"
${indent}  />
${indent}</div>`;
  }
}

/**
 * Generate test file
 */
function generateTestFile(spec: ToolSpec, toolKey: string): string {
  const pascalName = toPascalCase(toolKey);
  const camelName = toCamelCase(toolKey);

  return `/**
 * ${spec.name} - Test Suite
 * 
 * Generated by scaffold-tool on ${new Date().toISOString().split('T')[0]}
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ${pascalName}Controller } from '../../src/tools/${toolKey}/${toolKey}.controller';
import { ${pascalName}Service } from '../../src/tools/${toolKey}/${toolKey}.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  validate${pascalName}Input,
  apply${pascalName}Rules,
  generate${pascalName}Output,
} from '@hydra-frog/shared/tools/${toolKey}/rules';

describe('${pascalName}', () => {
  let controller: ${pascalName}Controller;
  let service: ${pascalName}Service;

  const mockPrismaService = {
    // Add mock methods as needed
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${pascalName}Controller],
      providers: [
        ${pascalName}Service,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<${pascalName}Controller>(${pascalName}Controller);
    service = module.get<${pascalName}Service>(${pascalName}Service);
  });

  describe('Controller', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have run endpoint', () => {
      expect(controller.run).toBeDefined();
    });

    it('should have getHistory endpoint', () => {
      expect(controller.getHistory).toBeDefined();
    });

    it('should have getResult endpoint', () => {
      expect(controller.getResult).toBeDefined();
    });

    it('should have exportResults endpoint', () => {
      expect(controller.exportResults).toBeDefined();
    });
  });

  describe('Service', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Rules', () => {
    describe('validate${pascalName}Input', () => {
      it('should validate empty input', () => {
        const result = validate${pascalName}Input({} as any);
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('errors');
      });

      // TODO: Add more validation tests
    });

    describe('apply${pascalName}Rules', () => {
      it('should process empty data', () => {
        const results = apply${pascalName}Rules({} as any, []);
        expect(Array.isArray(results)).toBe(true);
      });

      it('should process sample data', () => {
        const sampleData = [
          { id: '1', value: 'test1' },
          { id: '2', value: 'test2' },
        ];
        const results = apply${pascalName}Rules({} as any, sampleData);
        expect(results.length).toBe(2);
      });

      // TODO: Add more rule tests
    });

    describe('generate${pascalName}Output', () => {
      it('should generate output structure', () => {
        const output = generate${pascalName}Output({} as any, []);
        expect(output).toHaveProperty('summary');
        expect(output).toHaveProperty('results');
        expect(output).toHaveProperty('generatedAt');
      });

      // TODO: Add more output tests
    });
  });
});
`;
}

/**
 * Generate index barrel export for shared rules
 */
function generateSharedIndex(toolKey: string): string {
  return `export * from './rules';
`;
}

// ============================================
// SPEC LOADERS
// ============================================

/**
 * Load ToolSpec from a JSON file
 */
function loadSpecFromJson(jsonPath: string): ToolSpec {
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Validate required fields
    if (!data.name) {
      console.error('❌ JSON file missing required field: name');
      process.exit(1);
    }
    if (!data.blueprintJson) {
      console.error('❌ JSON file missing required field: blueprintJson');
      process.exit(1);
    }

    return {
      id: data.id || 'from-json',
      name: data.name,
      description: data.description || '',
      blueprintJson: data.blueprintJson,
      status: data.status || 'DRAFT',
      version: data.version || '1.0.0',
    };
  } catch (err) {
    console.error(`❌ Failed to parse JSON file: ${err}`);
    process.exit(1);
  }
}

/**
 * Load ToolSpec from database via API or direct Prisma
 */
async function loadSpecFromDb(specId: string, root: string): Promise<ToolSpec> {
  // Try to fetch via API first (if running)
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const apiToken = process.env.API_TOKEN;

  if (apiToken) {
    try {
      console.log('📡 Fetching ToolSpec via API...');
      const response = await fetch(`${apiUrl}/studio/specs/${specId}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          id: data.id,
          name: data.name,
          description: data.description || '',
          blueprintJson: data.blueprintJson,
          status: data.status,
          version: data.version,
        };
      }
    } catch {
      console.log('   API not available, trying direct DB access...');
    }
  }

  // Fall back to direct Prisma access
  console.log('📡 Fetching ToolSpec from database...');
  
  // Dynamic import for Prisma with adapter
  const pgPath = path.join(root, 'node_modules/pg');
  const prismaClientPath = path.join(root, 'node_modules/@prisma/client');
  const prismaAdapterPath = path.join(root, 'node_modules/@prisma/adapter-pg');

  try {
    const [pgModule, prismaClientModule, adapterModule] = await Promise.all([
      import(pgPath),
      import(prismaClientPath),
      import(prismaAdapterPath),
    ]);

    const { Pool } = pgModule.default || pgModule;
    const { PrismaClient } = prismaClientModule;
    const { PrismaPg } = adapterModule;

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const toolSpec = await prisma.toolSpec.findUnique({
      where: { id: specId },
    });

    await prisma.$disconnect();
    await pool.end();

    if (!toolSpec) {
      console.error(`❌ ToolSpec with ID "${specId}" not found`);
      process.exit(1);
    }

    return {
      id: toolSpec.id,
      name: toolSpec.name,
      description: toolSpec.description || '',
      blueprintJson: toolSpec.blueprintJson as BlueprintJson,
      status: toolSpec.status,
      version: toolSpec.version,
    };
  } catch (err) {
    console.error('❌ Failed to load from database:', err);
    console.error('');
    console.error('💡 Tips:');
    console.error('   1. Make sure DATABASE_URL is set in apps/api/.env');
    console.error('   2. Run: cd apps/api && pnpm prisma generate');
    console.error('   3. Or use --from-json <file> to load from a JSON file');
    process.exit(1);
  }
}

// ============================================
// MAIN SCAFFOLDER
// ============================================

async function scaffold(config: ScaffoldConfig): Promise<void> {
  const root = getMonorepoRoot();

  console.log('🚀 Tool Scaffolder');
  console.log('==================');
  if (config.fromJson) {
    console.log(`📄 JSON File: ${config.fromJson}`);
  } else {
    console.log(`📋 Spec ID: ${config.specId}`);
  }
  console.log(`🔍 Dry Run: ${config.dryRun}`);
  console.log(`💪 Force: ${config.force}`);
  console.log('');

  // Load spec from JSON file or database
  let spec: ToolSpec;
  if (config.fromJson) {
    spec = loadSpecFromJson(config.fromJson);
    console.log(`✅ Loaded from JSON: ${spec.name} (v${spec.version})`);
  } else {
    spec = await loadSpecFromDb(config.specId, root);
    console.log(`✅ Found: ${spec.name} (v${spec.version})`);
  }
  console.log(`   Status: ${spec.status}`);
  console.log('');

    // Generate tool key from name
    const toolKey = toToolKey(spec.name.replace(/^Tool:\s*/i, ''));
    const pascalName = toPascalCase(toolKey);
    console.log(`🔑 Tool Key: ${toolKey}`);
    console.log(`📛 Pascal Name: ${pascalName}`);
    console.log('');

    // Generate files
    const files: GeneratedFile[] = [
      // Shared rules module
      {
        path: path.join(root, 'packages/shared/src/tools', toolKey, 'rules.ts'),
        content: generateRulesModule(spec, toolKey),
      },
      {
        path: path.join(root, 'packages/shared/src/tools', toolKey, 'index.ts'),
        content: generateSharedIndex(toolKey),
      },
      // API module
      {
        path: path.join(root, 'apps/api/src/tools', toolKey, `${toolKey}.controller.ts`),
        content: generateController(spec, toolKey),
      },
      {
        path: path.join(root, 'apps/api/src/tools', toolKey, `${toolKey}.service.ts`),
        content: generateService(spec, toolKey),
      },
      {
        path: path.join(root, 'apps/api/src/tools', toolKey, `${toolKey}.module.ts`),
        content: generateModule(spec, toolKey),
      },
      {
        path: path.join(root, 'apps/api/src/tools', toolKey, 'index.ts'),
        content: `export * from './${toolKey}.module';\nexport * from './${toolKey}.controller';\nexport * from './${toolKey}.service';\n`,
      },
      // Dashboard page
      {
        path: path.join(root, 'apps/dashboard/src/app/tools', toolKey, 'page.tsx'),
        content: generateDashboardPage(spec, toolKey),
      },
      // Test file
      {
        path: path.join(root, 'apps/api/test/tools', `${toolKey}.spec.ts`),
        content: generateTestFile(spec, toolKey),
      },
    ];

    // Preview or write files
    console.log('📁 Generated Files:');
    console.log('-------------------');

    for (const file of files) {
      const relativePath = path.relative(root, file.path);
      const exists = fs.existsSync(file.path);

      if (exists && !config.force && !config.dryRun) {
        console.log(`⚠️  ${relativePath} (exists, skipping - use --force to overwrite)`);
        continue;
      }

      if (config.dryRun) {
        console.log(`📄 ${relativePath} ${exists ? '(would overwrite)' : '(new)'}`);
        console.log('   Preview (first 500 chars):');
        console.log('   ' + file.content.slice(0, 500).split('\n').join('\n   '));
        console.log('   ...');
        console.log('');
      } else {
        // Create directory if needed
        const dir = path.dirname(file.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`📁 Created directory: ${path.relative(root, dir)}`);
        }

        // Write file
        fs.writeFileSync(file.path, file.content, 'utf-8');
        console.log(`✅ ${relativePath} ${exists ? '(overwritten)' : '(created)'}`);
      }
    }

    console.log('');
    console.log('==================');

    if (config.dryRun) {
      console.log('🔍 Dry run complete. No files were written.');
      console.log('   Run without --dry-run to generate files.');
    } else {
      console.log('✅ Scaffolding complete!');
      console.log('');
      console.log('📋 Next steps:');
      console.log(`   1. Review generated files in packages/shared/src/tools/${toolKey}/`);
      console.log(`   2. Implement data fetching in apps/api/src/tools/${toolKey}/${toolKey}.service.ts`);
      console.log(`   3. Register module in apps/api/src/app.module.ts:`);
      console.log(`      import { ${pascalName}Module } from './tools/${toolKey}';`);
      console.log(`      @Module({ imports: [..., ${pascalName}Module] })`);
      console.log(`   4. Add route to dashboard navigation`);
      console.log(`   5. Run tests: pnpm test apps/api/test/tools/${toolKey}.spec.ts`);
    }
}

// ============================================
// RUN
// ============================================

const scaffoldConfig = parseCliArgs();
scaffold(scaffoldConfig);
