/**
 * Type definitions for the renderer worker
 */

export interface RenderJobData {
  crawlRunId: string;
  pageId: string;
  url: string;
}

export interface ConsoleError {
  type: string;
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export interface NetworkError {
  url: string;
  method: string;
  failure: string;
  resourceType: string;
}

export interface RenderResult {
  finalUrl: string;
  html: string;
  htmlHash: string;
  screenshot: Buffer;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1Count: number;
  wordCount: number;
  linksCount: number;
  consoleErrors: ConsoleError[];
  networkErrors: NetworkError[];
}

export interface ParsedHtml {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1Count: number;
  wordCount: number;
  linksCount: number;
}
