/**
 * Crawl settings with defaults
 */
export interface CrawlSettings {
  maxPages: number;
  maxDepth: number;
  ignoreParams: string[];
  respectRobots: boolean;
  throttleMs: number;
  includeSubdomains: boolean;
}

/**
 * Default crawl settings
 */
export const DEFAULT_CRAWL_SETTINGS: CrawlSettings = {
  maxPages: 1000,
  maxDepth: 5,
  ignoreParams: [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
  ],
  respectRobots: true,
  throttleMs: 100,
  includeSubdomains: false,
};

/**
 * Queue item for BFS traversal
 */
export interface QueueItem {
  url: string;
  depth: number;
}

/**
 * Result from fetching and parsing a page
 */
export interface PageResult {
  url: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number | null;
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
  links: string[];
  imagesMissingAlt: number;
  error: string | null;
}

/**
 * Build crawl settings from project settingsJson with defaults
 */
export function buildCrawlSettings(settingsJson: Record<string, unknown> | null): CrawlSettings {
  const settings = settingsJson ?? {};

  return {
    maxPages: typeof settings.maxPages === 'number' ? settings.maxPages : DEFAULT_CRAWL_SETTINGS.maxPages,
    maxDepth: typeof settings.maxDepth === 'number' ? settings.maxDepth : DEFAULT_CRAWL_SETTINGS.maxDepth,
    ignoreParams: Array.isArray(settings.ignoreParams) ? settings.ignoreParams : DEFAULT_CRAWL_SETTINGS.ignoreParams,
    respectRobots: typeof settings.respectRobots === 'boolean' ? settings.respectRobots : DEFAULT_CRAWL_SETTINGS.respectRobots,
    throttleMs: typeof settings.throttleMs === 'number' ? settings.throttleMs : DEFAULT_CRAWL_SETTINGS.throttleMs,
    includeSubdomains: typeof settings.includeSubdomains === 'boolean' ? settings.includeSubdomains : DEFAULT_CRAWL_SETTINGS.includeSubdomains,
  };
}
