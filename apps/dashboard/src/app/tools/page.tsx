'use client';

/**
 * Tools Index Page
 * 
 * Lists all available tools for the user.
 * New tools are scaffolded using: pnpm scaffold:tool --spec <toolSpecId>
 */

import Link from 'next/link';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';

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

// Register tools here after scaffolding
const TOOLS: ToolInfo[] = [
  // Example:
  // {
  //   key: 'seo-audit',
  //   name: 'SEO Audit Report',
  //   description: 'Comprehensive SEO health check',
  //   category: 'AUDIT',
  //   icon: '🔍',
  //   status: 'available',
  // },
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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
        <p className="text-gray-500 mt-1">
          Marketing experience tools powered by your crawl data
        </p>
      </div>

      {/* Tools Grid */}
      {TOOLS.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.key}
              href={`/tools/${tool.key}`}
              className={`bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all ${
                tool.status === 'coming-soon' ? 'opacity-60 pointer-events-none' : ''
              }`}
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
              {tool.status === 'beta' && (
                <span className="inline-block mt-3 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                  BETA
                </span>
              )}
              {tool.status === 'coming-soon' && (
                <span className="inline-block mt-3 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">
                  Coming Soon
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🛠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Tools Available Yet
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Tools are created from approved requests in the Marketing Experience Studio.
            Once a tool is built and shipped, it will appear here.
          </p>
          <Link
            href="/studio"
            className="inline-block mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Studio
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function ToolsPage() {
  return (
    <Protected>
      <AppShell>
        <ToolsContent />
      </AppShell>
    </Protected>
  );
}
