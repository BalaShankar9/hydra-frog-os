/**
 * Lighthouse runner - runs performance audits using Chrome headless
 * 
 * Hardened for production with:
 * - Proper Chrome lifecycle management (no leaks)
 * - Timeout protection
 * - Graceful error handling
 * - Resource cleanup
 */

import lighthouse, { Flags, Result } from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import type { LighthouseResult, LighthouseMetrics, LighthouseOpportunity } from '../types.js';

let chromeInstance: chromeLauncher.LaunchedChrome | null = null;
let chromeUseCount = 0;
const MAX_CHROME_USES = 20; // Restart Chrome after N uses to prevent memory leaks

/**
 * Check if Chrome process is still alive
 */
function isChromeAlive(chrome: chromeLauncher.LaunchedChrome): boolean {
  try {
    process.kill(chrome.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Chrome if not already running, or restart if stale
 */
async function launchChrome(): Promise<chromeLauncher.LaunchedChrome> {
  // Check if we need to restart Chrome (memory cleanup)
  if (chromeInstance && chromeUseCount >= MAX_CHROME_USES) {
    console.log('[PerfAuditor] Restarting Chrome after max uses...');
    await closeChrome();
  }

  // Check if existing instance is still alive
  if (chromeInstance && isChromeAlive(chromeInstance)) {
    chromeUseCount++;
    return chromeInstance;
  }

  // Clear stale reference
  if (chromeInstance) {
    chromeInstance = null;
    chromeUseCount = 0;
  }

  console.log('[PerfAuditor] Launching Chrome...');
  chromeInstance = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new', // Use new headless mode
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--js-flags=--max-old-space-size=512', // Limit memory
    ],
  });
  chromeUseCount = 1;
  console.log(`[PerfAuditor] Chrome launched on port ${chromeInstance.port} (pid: ${chromeInstance.pid})`);
  return chromeInstance;
}

/**
 * Close Chrome instance safely
 */
export async function closeChrome(): Promise<void> {
  if (chromeInstance) {
    const pid = chromeInstance.pid;
    try {
      await chromeInstance.kill();
      console.log(`[PerfAuditor] Chrome closed (pid: ${pid})`);
    } catch (error) {
      console.warn(`[PerfAuditor] Error closing Chrome: ${error}`);
      // Force kill if normal kill fails
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process already dead
      }
    }
    chromeInstance = null;
    chromeUseCount = 0;
  }
}

/**
 * Force restart Chrome (useful after errors)
 */
export async function restartChrome(): Promise<void> {
  await closeChrome();
  await launchChrome();
}

/**
 * Extract metrics from Lighthouse result
 */
function extractMetrics(lhr: Result): LighthouseMetrics {
  const audits = lhr.audits;

  // Helper to safely extract numeric value
  const getNumericValue = (auditId: string): number | null => {
    const audit = audits[auditId];
    if (!audit || audit.numericValue === undefined) return null;
    return Math.round(audit.numericValue);
  };

  // Get resource summary
  let totalRequests: number | null = null;
  let totalTransferSize: number | null = null;

  const resourceSummary = audits['resource-summary'];
  if (resourceSummary?.details && 'items' in resourceSummary.details) {
    const items = resourceSummary.details.items as Array<{ resourceType: string; requestCount: number; transferSize: number }>;
    const total = items.find(i => i.resourceType === 'total');
    if (total) {
      totalRequests = total.requestCount;
      totalTransferSize = total.transferSize;
    }
  }

  return {
    lcp: getNumericValue('largest-contentful-paint'),
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    inp: getNumericValue('experimental-interaction-to-next-paint') || getNumericValue('total-blocking-time'),
    fcp: getNumericValue('first-contentful-paint'),
    si: getNumericValue('speed-index'),
    tti: getNumericValue('interactive'),
    tbt: getNumericValue('total-blocking-time'),
    totalRequests,
    totalTransferSize,
  };
}

/**
 * Extract top opportunities from Lighthouse result
 */
function extractOpportunities(lhr: Result, limit: number = 8): LighthouseOpportunity[] {
  const opportunityAudits = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'uses-optimized-images',
    'uses-text-compression',
    'uses-responsive-images',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'preload-lcp-image',
    'total-byte-weight',
    'dom-size',
    'critical-request-chains',
    'redirects',
    'uses-rel-preconnect',
    'server-response-time',
    'uses-http2',
    'uses-long-cache-ttl',
  ];

  const opportunities: LighthouseOpportunity[] = [];

  for (const auditId of opportunityAudits) {
    const audit = lhr.audits[auditId];
    if (!audit) continue;

    // Only include audits with potential savings (score < 1 or has numericValue)
    if (audit.score === 1 && !audit.numericValue) continue;

    let savings: { ms?: number; bytes?: number } | null = null;

    // Extract savings from details if available
    if (audit.details && 'overallSavingsMs' in audit.details) {
      savings = { ms: Math.round(audit.details.overallSavingsMs as number) };
    }
    if (audit.details && 'overallSavingsBytes' in audit.details) {
      savings = { ...savings, bytes: audit.details.overallSavingsBytes as number };
    }

    opportunities.push({
      id: auditId,
      title: audit.title,
      description: audit.description || '',
      score: audit.score,
      savings,
    });
  }

  // Sort by score (lowest first = biggest opportunity) and limit
  return opportunities
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, limit);
}

/**
 * Run Lighthouse audit on a URL with timeout protection
 */
export async function runLighthouse(
  url: string,
  device: 'MOBILE' | 'DESKTOP',
  timeoutMs: number = 60000,
): Promise<LighthouseResult> {
  let chrome: chromeLauncher.LaunchedChrome;
  
  try {
    chrome = await launchChrome();
  } catch (error) {
    throw new Error(`Failed to launch Chrome: ${error instanceof Error ? error.message : String(error)}`);
  }

  const flags: Flags = {
    port: chrome.port,
    output: ['json', 'html'],
    onlyCategories: ['performance'],
    formFactor: device === 'MOBILE' ? 'mobile' : 'desktop',
    screenEmulation: device === 'MOBILE'
      ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
      : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: 'simulate',
    maxWaitForFcp: Math.min(timeoutMs, 30000),
    maxWaitForLoad: Math.min(timeoutMs, 45000),
  };

  // Set mobile/desktop specific settings
  if (device === 'DESKTOP') {
    flags.throttling = {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 10240,
      uploadThroughputKbps: 10240,
    };
  }

  console.log(`[PerfAuditor] Running Lighthouse on ${url} (${device})...`);

  // Run Lighthouse with timeout protection
  let result: Awaited<ReturnType<typeof lighthouse>> | null = null;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new Error(`Lighthouse audit timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    result = await Promise.race([
      lighthouse(url, flags),
      timeoutPromise,
    ]);
  } catch (error) {
    // On timeout or error, restart Chrome to clean up
    if (timedOut) {
      console.warn(`[PerfAuditor] Audit timed out for ${url}, restarting Chrome...`);
      await restartChrome();
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Detect common errors and provide better messages
    if (errorMessage.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error(`DNS resolution failed for ${url}`);
    }
    if (errorMessage.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Connection refused for ${url}`);
    }
    if (errorMessage.includes('ERR_SSL_PROTOCOL_ERROR')) {
      throw new Error(`SSL/TLS error for ${url}`);
    }
    if (errorMessage.includes('ERR_CERT')) {
      throw new Error(`Certificate error for ${url}`);
    }
    if (errorMessage.includes('ERR_BLOCKED')) {
      throw new Error(`Request blocked for ${url}`);
    }
    if (errorMessage.includes('timed out')) {
      throw new Error(`Navigation timed out for ${url}`);
    }
    
    throw error;
  }

  if (!result || !result.lhr || !result.report) {
    throw new Error('Lighthouse returned no result');
  }

  const lhr = result.lhr;
  const reports = result.report;

  // Check for Lighthouse-level errors
  if (lhr.runtimeError) {
    throw new Error(`Lighthouse runtime error: ${lhr.runtimeError.message}`);
  }

  // Get performance score (0-1 scale, convert to 0-100)
  const perfCategory = lhr.categories.performance;
  const score = perfCategory?.score !== null && perfCategory?.score !== undefined
    ? Math.round(perfCategory.score * 100)
    : 0;

  // Extract metrics and opportunities
  const metrics = extractMetrics(lhr);
  const opportunities = extractOpportunities(lhr);

  // Reports are returned as array [json, html] based on output order
  const jsonReport = Array.isArray(reports) ? reports[0] : reports;
  const htmlReport = Array.isArray(reports) ? reports[1] : '';

  console.log(`[PerfAuditor] Lighthouse complete: score=${score}`);

  return {
    score,
    metrics,
    opportunities,
    jsonReport: typeof jsonReport === 'string' ? jsonReport : JSON.stringify(jsonReport),
    htmlReport,
  };
}
