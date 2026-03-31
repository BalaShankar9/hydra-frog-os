/**
 * Diff Engine Utilities
 *
 * Provides:
 * - Stable JSON stringify for consistent comparisons
 * - Field limiting for beforeJson/afterJson storage optimization
 */

// ============================================
// Stable JSON Stringify
// ============================================

/**
 * Stable JSON stringify that produces consistent output regardless of
 * object key insertion order. This is essential for comparing JSON
 * objects across crawl runs.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => stableStringify(item)).join(',') + ']';
  }

  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = sortedKeys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      return JSON.stringify(key) + ':' + stableStringify(value);
    });
    return '{' + pairs.join(',') + '}';
  }

  return JSON.stringify(obj);
}

// ============================================
// Field Limiting for Storage Optimization
// ============================================

/**
 * Fields that are relevant for each diff type.
 * Only these fields will be stored in beforeJson/afterJson to reduce storage.
 */
export const RELEVANT_FIELDS_BY_TYPE: Record<string, string[]> = {
  STATUS_CHANGED: ['statusCode', 'url', 'normalizedUrl'],
  REDIRECT_CHAIN_CHANGED: ['redirectChainJson', 'url', 'normalizedUrl'],
  TITLE_CHANGED: ['title', 'url', 'normalizedUrl'],
  META_DESCRIPTION_CHANGED: ['metaDescription', 'url', 'normalizedUrl'],
  CANONICAL_CHANGED: ['canonical', 'url', 'normalizedUrl'],
  ROBOTS_CHANGED: ['robotsMeta', 'url', 'normalizedUrl'],
  H1_COUNT_CHANGED: ['h1Count', 'url', 'normalizedUrl'],
  WORDCOUNT_CHANGED: ['wordCount', 'url', 'normalizedUrl'],
  HTML_HASH_CHANGED: ['htmlHash', 'url', 'normalizedUrl'],
  TEMPLATE_CHANGED: ['templateId', 'url', 'normalizedUrl'],
  NEW_URL: ['statusCode', 'title', 'url', 'normalizedUrl'],
  REMOVED_URL: ['statusCode', 'title', 'url', 'normalizedUrl'],
};

/**
 * Default fields to include if diff type is unknown
 */
const DEFAULT_FIELDS = ['url', 'normalizedUrl', 'statusCode', 'title'];

/**
 * Pick only relevant fields from a page snapshot based on diff type.
 * This significantly reduces storage requirements for large crawls.
 */
export function pickRelevantFields<T>(
  snapshot: T | null,
  diffType: string
): Partial<T> | null {
  if (snapshot === null) {
    return null;
  }

  const relevantFields = RELEVANT_FIELDS_BY_TYPE[diffType] || DEFAULT_FIELDS;
  const result: Partial<T> = {};

  for (const field of relevantFields) {
    if (field in (snapshot as object)) {
      (result as Record<string, unknown>)[field] = (snapshot as Record<string, unknown>)[field];
    }
  }

  return result;
}

// ============================================
// Batch Processing Utilities
// ============================================

/**
 * Process items in batches with a callback.
 * Useful for database operations on large datasets.
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[], batchIndex: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const result = await processor(batch, batchIndex);
    results.push(result);
  }

  return results;
}

/**
 * Chunk an array into smaller arrays of specified size.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ============================================
// Performance Monitoring
// ============================================

/**
 * Simple timer for measuring operation duration.
 */
export function createTimer(): { elapsed: () => number; log: (label: string) => void } {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    log: (label: string) => {
      console.log(`[Timer] ${label}: ${Date.now() - start}ms`);
    },
  };
}
