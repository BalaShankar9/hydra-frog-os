/**
 * Type definitions for the perf-auditor worker
 */

export interface PerfJobData {
  crawlRunId: string;
  projectId: string;
  pageId?: string;
  url: string;
  templateId?: string;
  device: 'MOBILE' | 'DESKTOP';
}

export interface LighthouseMetrics {
  // Core Web Vitals
  lcp: number | null;      // Largest Contentful Paint (ms)
  cls: number | null;      // Cumulative Layout Shift
  inp: number | null;      // Interaction to Next Paint (ms) - or TBT as fallback
  
  // Other performance metrics
  fcp: number | null;      // First Contentful Paint (ms)
  si: number | null;       // Speed Index (ms)
  tti: number | null;      // Time to Interactive (ms)
  tbt: number | null;      // Total Blocking Time (ms)
  
  // Resource metrics
  totalRequests: number | null;
  totalTransferSize: number | null;  // bytes
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  score: number | null;
  savings: {
    ms?: number;
    bytes?: number;
  } | null;
}

export interface LighthouseResult {
  score: number;
  metrics: LighthouseMetrics;
  opportunities: LighthouseOpportunity[];
  htmlReport: string;
  jsonReport: string;
}
