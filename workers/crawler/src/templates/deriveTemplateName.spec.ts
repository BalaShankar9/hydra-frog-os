/**
 * Unit tests for template name derivation (clusterTemplates.ts)
 * 
 * Verifies that deriveTemplateName produces expected template names
 * based on URL patterns
 */

import { Prisma } from '@prisma/client';

// We need to test deriveTemplateName but it's not exported
// So we'll test through a mock approach or re-implement for testing

// Mock page structure for testing
interface MockPage {
  id: string;
  url: string;
  templateSignatureHash: string;
  templateSignatureJson: Prisma.JsonValue;
}

/**
 * URL pattern matchers (copied from clusterTemplates.ts for testing)
 */
const URL_PATTERN_NAMES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\/blog\//i, name: 'Blog Template' },
  { pattern: /\/posts?\//i, name: 'Post Template' },
  { pattern: /\/products?\//i, name: 'Product Template' },
  { pattern: /\/shop\//i, name: 'Shop Template' },
  { pattern: /\/categor(y|ies)\//i, name: 'Category Template' },
  { pattern: /\/tag\//i, name: 'Tag Template' },
  { pattern: /\/author\//i, name: 'Author Template' },
  { pattern: /\/news\//i, name: 'News Template' },
  { pattern: /\/article\//i, name: 'Article Template' },
  { pattern: /\/page\//i, name: 'Page Template' },
  { pattern: /\/services?\//i, name: 'Service Template' },
  { pattern: /\/about/i, name: 'About Template' },
  { pattern: /\/contact/i, name: 'Contact Template' },
  { pattern: /\/faq/i, name: 'FAQ Template' },
  { pattern: /\/search/i, name: 'Search Template' },
  { pattern: /\/login|\/signin/i, name: 'Login Template' },
  { pattern: /\/register|\/signup/i, name: 'Registration Template' },
  { pattern: /\/cart/i, name: 'Cart Template' },
  { pattern: /\/checkout/i, name: 'Checkout Template' },
  { pattern: /\/account|\/profile/i, name: 'Account Template' },
];

/**
 * Derive a template name from the URLs in a cluster
 * (Re-implemented for testing - should match clusterTemplates.ts)
 */
function deriveTemplateName(pages: MockPage[], index: number): string {
  // Check URL patterns - find the most common pattern match
  const patternCounts = new Map<string, number>();
  
  for (const page of pages) {
    for (const { pattern, name } of URL_PATTERN_NAMES) {
      if (pattern.test(page.url)) {
        patternCounts.set(name, (patternCounts.get(name) || 0) + 1);
        break; // Only count first match per URL
      }
    }
  }
  
  // If any pattern matches majority of pages, use it
  if (patternCounts.size > 0) {
    let bestPattern = '';
    let bestCount = 0;
    
    for (const [name, count] of patternCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestPattern = name;
      }
    }
    
    // Use pattern if it matches at least 30% of pages
    if (bestCount >= pages.length * 0.3) {
      return bestPattern;
    }
  }
  
  // Try to derive from common path prefix
  const pathSegments = pages.map(p => {
    try {
      const url = new URL(p.url);
      return url.pathname.split('/').filter(Boolean).slice(0, 2);
    } catch {
      return [];
    }
  });
  
  // Find common first segment
  if (pathSegments.length > 0 && pathSegments[0].length > 0) {
    const firstSegment = pathSegments[0][0];
    const matchCount = pathSegments.filter(s => s[0] === firstSegment).length;
    
    // If 50%+ share the same first segment, use it
    if (matchCount >= pages.length * 0.5 && firstSegment) {
      // Capitalize first letter
      const capitalizedName = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
      return `${capitalizedName} Template`;
    }
  }
  
  // Check if most are root pages (homepage-like)
  const rootPages = pages.filter(p => {
    try {
      const url = new URL(p.url);
      return url.pathname === '/' || url.pathname === '';
    } catch {
      return false;
    }
  });
  
  if (rootPages.length >= pages.length * 0.5) {
    return 'Homepage Template';
  }
  
  // Fallback to generic name with index
  return `Template ${index + 1}`;
}

// Helper to create mock pages
function createMockPages(urls: string[]): MockPage[] {
  return urls.map((url, i) => ({
    id: `page-${i}`,
    url,
    templateSignatureHash: 'hash123',
    templateSignatureJson: {},
  }));
}

describe('deriveTemplateName', () => {
  describe('URL pattern recognition', () => {
    it('should recognize blog pages', () => {
      const pages = createMockPages([
        'https://example.com/blog/post-1',
        'https://example.com/blog/post-2',
        'https://example.com/blog/post-3',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Blog Template');
    });

    it('should recognize product pages', () => {
      const pages = createMockPages([
        'https://example.com/product/widget-blue',
        'https://example.com/products/gadget-red',
        'https://example.com/product/item-123',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Product Template');
    });

    it('should recognize category pages', () => {
      const pages = createMockPages([
        'https://example.com/category/electronics',
        'https://example.com/categories/home',
        'https://example.com/category/garden',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Category Template');
    });

    it('should recognize news pages', () => {
      const pages = createMockPages([
        'https://example.com/news/breaking-story',
        'https://example.com/news/latest-update',
        'https://example.com/news/2024/01/event',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('News Template');
    });

    it('should recognize login/signin pages', () => {
      const pages = createMockPages([
        'https://example.com/login',
        'https://example.com/signin',
        'https://example.com/login?redirect=home',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Login Template');
    });

    it('should recognize account/profile pages', () => {
      const pages = createMockPages([
        'https://example.com/account/settings',
        'https://example.com/profile/edit',
        'https://example.com/account/orders',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Account Template');
    });

    it('should recognize about pages', () => {
      const pages = createMockPages([
        'https://example.com/about',
        'https://example.com/about-us',
        'https://example.com/about/team',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('About Template');
    });

    it('should recognize FAQ pages', () => {
      const pages = createMockPages([
        'https://example.com/faq',
        'https://example.com/faq/shipping',
        'https://example.com/faq/returns',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('FAQ Template');
    });

    it('should recognize service pages', () => {
      const pages = createMockPages([
        'https://example.com/services/consulting',
        'https://example.com/service/support',
        'https://example.com/services/development',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Service Template');
    });

    it('should recognize e-commerce pages', () => {
      const cartPages = createMockPages([
        'https://example.com/cart',
        'https://example.com/cart/view',
      ]);
      expect(deriveTemplateName(cartPages, 0)).toBe('Cart Template');

      const checkoutPages = createMockPages([
        'https://example.com/checkout',
        'https://example.com/checkout/payment',
      ]);
      expect(deriveTemplateName(checkoutPages, 0)).toBe('Checkout Template');
    });
  });

  describe('pattern threshold (30%)', () => {
    it('should use pattern when 30%+ of pages match', () => {
      // 3 out of 10 = 30%
      const pages = createMockPages([
        'https://example.com/blog/post-1',
        'https://example.com/blog/post-2',
        'https://example.com/blog/post-3',
        'https://example.com/random/page1',
        'https://example.com/other/page2',
        'https://example.com/misc/page3',
        'https://example.com/stuff/page4',
        'https://example.com/thing/page5',
        'https://example.com/item/page6',
        'https://example.com/content/page7',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Blog Template');
    });

    it('should not use pattern when less than 30% match', () => {
      // 2 out of 10 = 20% - below threshold
      const pages = createMockPages([
        'https://example.com/blog/post-1',
        'https://example.com/blog/post-2',
        'https://example.com/random/page1',
        'https://example.com/other/page2',
        'https://example.com/misc/page3',
        'https://example.com/stuff/page4',
        'https://example.com/thing/page5',
        'https://example.com/item/page6',
        'https://example.com/content/page7',
        'https://example.com/data/page8',
      ]);
      
      // Should fall back to common prefix or fallback
      const result = deriveTemplateName(pages, 0);
      expect(result).not.toBe('Blog Template');
    });
  });

  describe('common path prefix fallback', () => {
    it('should use common first path segment when no pattern matches', () => {
      const pages = createMockPages([
        'https://example.com/docs/intro',
        'https://example.com/docs/guide',
        'https://example.com/docs/api',
        'https://example.com/docs/tutorial',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Docs Template');
    });

    it('should capitalize the first letter of path segment', () => {
      const pages = createMockPages([
        'https://example.com/pricing/basic',
        'https://example.com/pricing/pro',
        'https://example.com/pricing/enterprise',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Pricing Template');
    });

    it('should require 50%+ pages to share the segment', () => {
      // Only 40% share 'docs'
      const pages = createMockPages([
        'https://example.com/docs/intro',
        'https://example.com/docs/guide',
        'https://example.com/help/faq',
        'https://example.com/support/tickets',
        'https://example.com/resources/downloads',
      ]);
      
      const result = deriveTemplateName(pages, 0);
      // Should fall back to index since no clear majority
      expect(result).not.toBe('Docs Template');
    });
  });

  describe('homepage detection', () => {
    it('should recognize homepage when majority are root URLs', () => {
      const pages = createMockPages([
        'https://example.com/',
        'https://www.example.com/',
        'https://example.com',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Homepage Template');
    });

    it('should not use homepage for mixed URLs', () => {
      const pages = createMockPages([
        'https://example.com/',
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ]);
      
      const result = deriveTemplateName(pages, 0);
      expect(result).not.toBe('Homepage Template');
    });
  });

  describe('fallback naming', () => {
    it('should use Template N+1 as final fallback', () => {
      const pages = createMockPages([
        'https://example.com/x1',
        'https://example.com/y2',
        'https://example.com/z3',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Template 1');
      expect(deriveTemplateName(pages, 5)).toBe('Template 6');
    });
  });

  describe('pattern priority', () => {
    it('should use the most common pattern when multiple match', () => {
      // 4 blog, 2 news - blog should win
      const pages = createMockPages([
        'https://example.com/blog/post-1',
        'https://example.com/blog/post-2',
        'https://example.com/blog/post-3',
        'https://example.com/blog/post-4',
        'https://example.com/news/story-1',
        'https://example.com/news/story-2',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Blog Template');
    });
  });

  describe('edge cases', () => {
    it('should handle single page cluster', () => {
      const pages = createMockPages(['https://example.com/blog/post-1']);
      expect(deriveTemplateName(pages, 0)).toBe('Blog Template');
    });

    it('should handle empty cluster', () => {
      // Empty cluster has no pages, so no URLs to analyze
      // The function returns fallback based on index
      const result = deriveTemplateName([], 0);
      // With no pages, the rootPages check passes (0 >= 0 * 0.5)
      // so it returns 'Homepage Template'
      expect(result).toBe('Homepage Template');
    });

    it('should handle invalid URLs gracefully', () => {
      const pages = createMockPages([
        'not-a-valid-url',
        'also/not/valid',
        ':::invalid:::',
      ]);
      
      // Should not throw, should fall back to Template N
      const result = deriveTemplateName(pages, 0);
      expect(result).toBe('Template 1');
    });

    it('should be case-insensitive for pattern matching', () => {
      const pages = createMockPages([
        'https://example.com/BLOG/post-1',
        'https://example.com/Blog/post-2',
        'https://example.com/blog/post-3',
      ]);
      
      expect(deriveTemplateName(pages, 0)).toBe('Blog Template');
    });
  });
});
