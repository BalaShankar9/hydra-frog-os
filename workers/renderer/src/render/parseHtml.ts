/**
 * Parse rendered HTML using Cheerio
 * Extracts SEO-relevant fields from the rendered DOM
 */

import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { ParsedHtml } from './types.js';

/**
 * Extract SEO fields from HTML using Cheerio
 */
export function parseRenderedHtml(html: string): ParsedHtml {
  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').first().text().trim() || null;

  // Extract meta description
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  // Extract canonical
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;

  // Extract robots meta
  const robotsMeta =
    $('meta[name="robots"]').attr('content')?.trim() ||
    $('meta[name="googlebot"]').attr('content')?.trim() ||
    null;

  // Count H1 tags
  const h1Count = $('h1').length;

  // Count words in body text
  const bodyText = $('body')
    .clone()
    .find('script, style, noscript')
    .remove()
    .end()
    .text();
  const words = bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  // Count links (excluding mailto, tel, javascript)
  const links = $('a[href]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((href): href is string => {
      if (!href) return false;
      const lower = href.toLowerCase();
      return (
        !lower.startsWith('mailto:') &&
        !lower.startsWith('tel:') &&
        !lower.startsWith('javascript:') &&
        !lower.startsWith('#')
      );
    });
  const linksCount = links.length;

  return {
    title,
    metaDescription,
    canonical,
    robotsMeta,
    h1Count,
    wordCount,
    linksCount,
  };
}

/**
 * Compute SHA256 hash of HTML content
 */
export function hashHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}
