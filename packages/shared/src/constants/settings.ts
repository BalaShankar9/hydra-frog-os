/**
 * Render Mode for automatic JS rendering after crawl
 */
export type RenderMode = 'OFF' | 'KEY_PAGES' | 'ALL_HTML';

/**
 * Default project settings including renderMode
 */
export const DEFAULT_PROJECT_SETTINGS = {
  maxPages: 1000,
  maxDepth: 10,
  respectRobotsTxt: true,
  includeSubdomains: false,
  crawlDelay: 100,
  userAgent: 'HydraFrogBot/1.0 (+https://hydrafrog.io/bot)',
  renderMode: 'KEY_PAGES' as RenderMode,
};

/**
 * Type for project settings JSON
 */
export interface ProjectSettings {
  maxPages?: number;
  maxDepth?: number;
  respectRobotsTxt?: boolean;
  includeSubdomains?: boolean;
  crawlDelay?: number;
  userAgent?: string;
  renderMode?: RenderMode;
}
