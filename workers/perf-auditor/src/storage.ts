/**
 * Storage utilities for Lighthouse reports
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';

/**
 * Hash a URL to create a safe filesystem path
 */
export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/**
 * Get the storage path for a Lighthouse report
 */
export function getReportPath(
  crawlRunId: string,
  url: string,
  device: 'MOBILE' | 'DESKTOP',
  ext: 'json' | 'html',
): string {
  const urlHash = hashUrl(url);
  const deviceLower = device.toLowerCase();
  return join(config.storage.basePath, crawlRunId, urlHash, `${deviceLower}.${ext}`);
}

/**
 * Store Lighthouse reports to filesystem
 */
export async function storeReports(
  crawlRunId: string,
  url: string,
  device: 'MOBILE' | 'DESKTOP',
  jsonReport: string,
  htmlReport: string,
): Promise<{ jsonPath: string; htmlPath: string }> {
  const jsonPath = getReportPath(crawlRunId, url, device, 'json');
  const htmlPath = getReportPath(crawlRunId, url, device, 'html');

  // Ensure directory exists
  await mkdir(dirname(jsonPath), { recursive: true });

  // Write reports
  await Promise.all([
    writeFile(jsonPath, jsonReport, 'utf-8'),
    writeFile(htmlPath, htmlReport, 'utf-8'),
  ]);

  console.log(`[PerfAuditor] Reports stored at ${dirname(jsonPath)}`);

  return { jsonPath, htmlPath };
}
