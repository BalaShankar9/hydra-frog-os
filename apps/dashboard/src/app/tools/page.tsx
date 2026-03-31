'use client';

import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// ============================================
// TOOL REGISTRY
// ============================================

interface ToolInfo {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'beta';
}

const TOOLS: ToolInfo[] = [
  {
    key: 'seo-health-dashboard',
    name: 'SEO Health Dashboard',
    description: 'Comprehensive SEO health score with issue breakdown across your crawl data',
    category: 'AUDIT',
    icon: '🩺',
    status: 'available',
  },
  {
    key: 'redirect-mapper',
    name: 'Redirect Mapper',
    description: 'Visualize and analyze redirect chains across your site',
    category: 'ANALYTICS',
    icon: '🔀',
    status: 'coming-soon',
  },
  {
    key: 'content-gap-analyzer',
    name: 'Content Gap Analyzer',
    description: 'Identify thin content pages and missing keyword coverage',
    category: 'CONTENT',
    icon: '📊',
    status: 'coming-soon',
  },
  {
    key: 'internal-link-optimizer',
    name: 'Internal Link Optimizer',
    description: 'Find orphan pages and optimize internal link distribution',
    category: 'ANALYTICS',
    icon: '🔗',
    status: 'coming-soon',
  },
  {
    key: 'schema-validator',
    name: 'Schema Markup Validator',
    description: 'Validate structured data across all crawled pages',
    category: 'AUDIT',
    icon: '🏷️',
    status: 'coming-soon',
  },
  {
    key: 'sitemap-generator',
    name: 'Sitemap Generator',
    description: 'Auto-generate XML sitemaps from crawl data',
    category: 'EXPORT',
    icon: '🗺️',
    status: 'coming-soon',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  ANALYTICS: 'bg-blue-100 text-blue-700',
  AUDIT: 'bg-green-100 text-green-700',
  AUTOMATION: 'bg-purple-100 text-purple-700',
  CALCULATOR: 'bg-orange-100 text-orange-700',
  COMPARISON: 'bg-pink-100 text-pink-700',
  CONTENT: 'bg-yellow-100 text-yellow-700',
  EXPORT: 'bg-gray-100 text-gray-700',
  MONITORING: 'bg-red-100 text-red-700',
  VISUALIZATION: 'bg-cyan-100 text-cyan-700',
};

// ============================================
// MAIN CONTENT
// ============================================

function ToolsContent() {
  const available = TOOLS.filter((t) => t.status === 'available');
  const upcoming = TOOLS.filter((t) => t.status !== 'available');

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Tools' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SEO Tools</h1>
        <p className="text-gray-500 mt-1">
          Powerful tools powered by your crawl data
        </p>
      </div>

      {/* Available Tools */}
      {available.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Available
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map((tool) => (
              <Link
                key={tool.key}
                href={`/tools/${tool.key}`}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{tool.icon}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${CATEGORY_COLORS[tool.category] || 'bg-gray-100 text-gray-600'}`}>
                    {tool.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
                {tool.status === 'beta' && (
                  <span className="inline-block mt-3 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                    BETA
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Coming Soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map((tool) => (
              <div
                key={tool.key}
                className="bg-white rounded-xl border border-gray-200 p-6 opacity-60"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{tool.icon}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${CATEGORY_COLORS[tool.category] || 'bg-gray-100 text-gray-600'}`}>
                    {tool.category}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {tool.name}
                </h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
                <span className="inline-block mt-3 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ToolsPage() {
  return (
    <Protected>
      <AppShell>
        <ToolsContent />
      </AppShell>
    </Protected>
  );
}
