/**
 * Playwright page renderer
 * Renders a page using headless Chromium and captures SEO-relevant data
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { parseRenderedHtml, hashHtml } from './parseHtml.js';
import type { RenderResult, ConsoleError, NetworkError } from './types.js';

let browser: Browser | null = null;

/**
 * Get or create the shared browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    console.log('[Renderer] Launching Chromium browser...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('[Renderer] Chromium browser launched');
  }
  return browser;
}

/**
 * Close the shared browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[Renderer] Browser closed');
  }
}

/**
 * Render a page and capture all SEO-relevant data
 */
export async function renderPage(
  url: string,
  timeoutMs: number = 20000,
): Promise<RenderResult> {
  const browserInstance = await getBrowser();
  
  // Create a new context for isolation
  const context: BrowserContext = await browserInstance.newContext({
    userAgent: 'HydraFrogRenderer/1.0 (+https://hydrafrog.io/bot)',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });

  const page: Page = await context.newPage();

  // Collect console errors
  const consoleErrors: ConsoleError[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
          ? {
              url: msg.location().url,
              lineNumber: msg.location().lineNumber,
              columnNumber: msg.location().columnNumber,
            }
          : undefined,
      });
    }
  });

  // Collect network failures
  const networkErrors: NetworkError[] = [];
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    networkErrors.push({
      url: request.url(),
      method: request.method(),
      failure: failure?.errorText || 'Unknown error',
      resourceType: request.resourceType(),
    });
  });

  try {
    // Navigate to the page
    console.log(`[Renderer] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Best effort wait for network idle
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Network idle timeout is acceptable - page may have streaming content
      console.log('[Renderer] Network idle timeout (acceptable)');
    }

    // Capture final URL after any redirects
    const finalUrl = page.url();
    console.log(`[Renderer] Final URL: ${finalUrl}`);

    // Capture rendered HTML
    const html = await page.content();

    // Capture screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    // Parse the rendered HTML
    const parsed = parseRenderedHtml(html);
    const htmlHash = hashHtml(html);

    return {
      finalUrl,
      html,
      htmlHash,
      screenshot,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      canonical: parsed.canonical,
      robotsMeta: parsed.robotsMeta,
      h1Count: parsed.h1Count,
      wordCount: parsed.wordCount,
      linksCount: parsed.linksCount,
      consoleErrors,
      networkErrors,
    };
  } finally {
    await page.close();
    await context.close();
  }
}
