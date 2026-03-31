/**
 * Tests for parseHtml module
 * Verifies HTML extraction and hash stability
 */

import { parseRenderedHtml, hashHtml } from './parseHtml.js';

describe('parseRenderedHtml', () => {
  describe('title extraction', () => {
    it('should extract title from head', () => {
      const html = '<html><head><title>Test Page Title</title></head><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.title).toBe('Test Page Title');
    });

    it('should trim whitespace from title', () => {
      const html = '<html><head><title>  Padded Title  </title></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.title).toBe('Padded Title');
    });

    it('should return null for missing title', () => {
      const html = '<html><head></head><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.title).toBeNull();
    });

    it('should handle empty title', () => {
      const html = '<html><head><title></title></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.title).toBeNull();
    });
  });

  describe('meta description extraction', () => {
    it('should extract meta description', () => {
      const html = '<html><head><meta name="description" content="Page description"></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.metaDescription).toBe('Page description');
    });

    it('should fall back to og:description', () => {
      const html = '<html><head><meta property="og:description" content="OG description"></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.metaDescription).toBe('OG description');
    });

    it('should prefer meta description over og:description', () => {
      const html = `<html><head>
        <meta name="description" content="Meta description">
        <meta property="og:description" content="OG description">
      </head></html>`;
      const result = parseRenderedHtml(html);
      expect(result.metaDescription).toBe('Meta description');
    });

    it('should return null for missing meta description', () => {
      const html = '<html><head></head><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.metaDescription).toBeNull();
    });
  });

  describe('canonical extraction', () => {
    it('should extract canonical URL', () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page"></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.canonical).toBe('https://example.com/page');
    });

    it('should return null for missing canonical', () => {
      const html = '<html><head></head><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.canonical).toBeNull();
    });
  });

  describe('robots meta extraction', () => {
    it('should extract robots meta', () => {
      const html = '<html><head><meta name="robots" content="noindex, nofollow"></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.robotsMeta).toBe('noindex, nofollow');
    });

    it('should fall back to googlebot meta', () => {
      const html = '<html><head><meta name="googlebot" content="nosnippet"></head></html>';
      const result = parseRenderedHtml(html);
      expect(result.robotsMeta).toBe('nosnippet');
    });

    it('should return null for missing robots meta', () => {
      const html = '<html><head></head><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.robotsMeta).toBeNull();
    });
  });

  describe('H1 count', () => {
    it('should count H1 tags', () => {
      const html = '<html><body><h1>Title 1</h1><h1>Title 2</h1></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.h1Count).toBe(2);
    });

    it('should return 0 for no H1 tags', () => {
      const html = '<html><body><h2>Not H1</h2></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.h1Count).toBe(0);
    });
  });

  describe('word count', () => {
    it('should count words in body text', () => {
      const html = '<html><body><p>This is a test paragraph with eight words.</p></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.wordCount).toBe(8);
    });

    it('should exclude script content from word count', () => {
      const html = `<html><body>
        <p>Real content here</p>
        <script>var x = "should not count";</script>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.wordCount).toBe(3);
    });

    it('should exclude style content from word count', () => {
      const html = `<html><body>
        <p>Just these words</p>
        <style>.class { color: red; }</style>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.wordCount).toBe(3);
    });

    it('should handle empty body', () => {
      const html = '<html><body></body></html>';
      const result = parseRenderedHtml(html);
      expect(result.wordCount).toBe(0);
    });
  });

  describe('links count', () => {
    it('should count valid links', () => {
      const html = `<html><body>
        <a href="/page1">Link 1</a>
        <a href="https://example.com/page2">Link 2</a>
        <a href="http://example.com/page3">Link 3</a>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.linksCount).toBe(3);
    });

    it('should exclude mailto links', () => {
      const html = `<html><body>
        <a href="/valid">Valid</a>
        <a href="mailto:test@example.com">Email</a>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.linksCount).toBe(1);
    });

    it('should exclude tel links', () => {
      const html = `<html><body>
        <a href="/valid">Valid</a>
        <a href="tel:+1234567890">Phone</a>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.linksCount).toBe(1);
    });

    it('should exclude javascript links', () => {
      const html = `<html><body>
        <a href="/valid">Valid</a>
        <a href="javascript:void(0)">JS</a>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.linksCount).toBe(1);
    });

    it('should exclude anchor-only links', () => {
      const html = `<html><body>
        <a href="/valid">Valid</a>
        <a href="#section">Anchor</a>
      </body></html>`;
      const result = parseRenderedHtml(html);
      expect(result.linksCount).toBe(1);
    });
  });

  describe('complex HTML parsing', () => {
    it('should parse a complete HTML document', () => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Awesome Page</title>
  <meta name="description" content="This is my awesome page description">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://example.com/awesome">
</head>
<body>
  <h1>Welcome to My Page</h1>
  <p>This is some content with multiple words in it.</p>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
  <script>console.log("ignored");</script>
</body>
</html>`;
      
      const result = parseRenderedHtml(html);
      
      expect(result.title).toBe('My Awesome Page');
      expect(result.metaDescription).toBe('This is my awesome page description');
      expect(result.canonical).toBe('https://example.com/awesome');
      expect(result.robotsMeta).toBe('index, follow');
      expect(result.h1Count).toBe(1);
      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.linksCount).toBe(2);
    });
  });
});

describe('hashHtml', () => {
  it('should return consistent hash for same content', () => {
    const html = '<html><body>Test content</body></html>';
    const hash1 = hashHtml(html);
    const hash2 = hashHtml(html);
    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different content', () => {
    const html1 = '<html><body>Content A</body></html>';
    const html2 = '<html><body>Content B</body></html>';
    const hash1 = hashHtml(html1);
    const hash2 = hashHtml(html2);
    expect(hash1).not.toBe(hash2);
  });

  it('should return a 64-character hex string (SHA256)', () => {
    const html = '<html><body>Test</body></html>';
    const hash = hashHtml(html);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be case sensitive', () => {
    const html1 = '<html><body>Test</body></html>';
    const html2 = '<html><body>test</body></html>';
    expect(hashHtml(html1)).not.toBe(hashHtml(html2));
  });

  it('should handle empty string', () => {
    const hash = hashHtml('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle unicode content', () => {
    const html = '<html><body>日本語 コンテンツ 🎉</body></html>';
    const hash = hashHtml(html);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Verify stability
    expect(hashHtml(html)).toBe(hash);
  });
});
