/**
 * Unit tests for computeTemplateSignature
 * 
 * Verifies that:
 * - Same structure with different content produces same hash
 * - Different structures produce different hashes
 * - Edge cases are handled gracefully
 */

import { computeTemplateSignature } from './computeTemplateSignature.js';

describe('computeTemplateSignature', () => {
  describe('stability - same structure produces same hash', () => {
    it('should produce same hash for identical HTML structure with different text content', () => {
      const html1 = `
        <!DOCTYPE html>
        <html>
        <head><title>Page Title 1</title></head>
        <body>
          <header><nav><a href="/">Home</a></nav></header>
          <main>
            <article>
              <h1>Article Title One</h1>
              <p>This is the first paragraph with unique content.</p>
              <p>Second paragraph here with more text.</p>
            </article>
          </main>
          <footer><p>Copyright 2024</p></footer>
        </body>
        </html>
      `;

      const html2 = `
        <!DOCTYPE html>
        <html>
        <head><title>Page Title 2</title></head>
        <body>
          <header><nav><a href="/">Home</a></nav></header>
          <main>
            <article>
              <h1>Completely Different Title</h1>
              <p>Totally different first paragraph content.</p>
              <p>Also different second paragraph text.</p>
            </article>
          </main>
          <footer><p>Copyright 2025</p></footer>
        </body>
        </html>
      `;

      const result1 = computeTemplateSignature(html1);
      const result2 = computeTemplateSignature(html2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });

    it('should produce same hash for blog-style pages with different articles', () => {
      const blogPage1 = `
        <html><body>
          <header><nav><a href="/">Blog</a></nav></header>
          <main>
            <article class="post">
              <h2>How to Learn JavaScript</h2>
              <p>JavaScript is a great language...</p>
              <a href="/post/1">Read more</a>
            </article>
            <article class="post">
              <h2>CSS Tips and Tricks</h2>
              <p>CSS can be tricky sometimes...</p>
              <a href="/post/2">Read more</a>
            </article>
          </main>
          <footer><p>My Blog 2024</p></footer>
        </body></html>
      `;

      const blogPage2 = `
        <html><body>
          <header><nav><a href="/">Blog</a></nav></header>
          <main>
            <article class="post">
              <h2>Understanding React Hooks</h2>
              <p>React hooks changed everything...</p>
              <a href="/post/3">Read more</a>
            </article>
            <article class="post">
              <h2>Node.js Best Practices</h2>
              <p>When building Node apps...</p>
              <a href="/post/4">Read more</a>
            </article>
          </main>
          <footer><p>My Blog 2024</p></footer>
        </body></html>
      `;

      const result1 = computeTemplateSignature(blogPage1);
      const result2 = computeTemplateSignature(blogPage2);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });

    it('should produce same hash for product pages with different products', () => {
      const product1 = `
        <html><body>
          <header><nav><a href="/">Shop</a></nav></header>
          <main>
            <section class="product-detail">
              <h1>Blue Widget</h1>
              <p class="price">$29.99</p>
              <p class="description">A wonderful blue widget.</p>
              <button>Add to Cart</button>
              <form action="/cart"><input type="hidden" name="id" value="1"></form>
            </section>
          </main>
          <footer><p>Shop Inc</p></footer>
        </body></html>
      `;

      const product2 = `
        <html><body>
          <header><nav><a href="/">Shop</a></nav></header>
          <main>
            <section class="product-detail">
              <h1>Red Gadget</h1>
              <p class="price">$49.99</p>
              <p class="description">An amazing red gadget.</p>
              <button>Add to Cart</button>
              <form action="/cart"><input type="hidden" name="id" value="2"></form>
            </section>
          </main>
          <footer><p>Shop Inc</p></footer>
        </body></html>
      `;

      const result1 = computeTemplateSignature(product1);
      const result2 = computeTemplateSignature(product2);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });
  });

  describe('differentiation - different structures produce different hashes', () => {
    it('should produce different hashes for different landmark structures', () => {
      const withArticle = `
        <html><body>
          <header><nav></nav></header>
          <main><article><p>Content</p></article></main>
          <footer></footer>
        </body></html>
      `;

      const withSection = `
        <html><body>
          <header><nav></nav></header>
          <main><section><p>Content</p></section></main>
          <footer></footer>
        </body></html>
      `;

      const result1 = computeTemplateSignature(withArticle);
      const result2 = computeTemplateSignature(withSection);

      expect(result1!.signatureHash).not.toBe(result2!.signatureHash);
    });

    it('should produce different hashes when form elements differ', () => {
      const withForm = `
        <html><body>
          <main>
            <form>
              <input type="text" name="email">
              <input type="password" name="pass">
              <button type="submit">Login</button>
            </form>
          </main>
        </body></html>
      `;

      const withoutForm = `
        <html><body>
          <main>
            <p>Welcome to our site</p>
            <p>Please check back later</p>
          </main>
        </body></html>
      `;

      const result1 = computeTemplateSignature(withForm);
      const result2 = computeTemplateSignature(withoutForm);

      expect(result1!.signatureHash).not.toBe(result2!.signatureHash);
    });

    it('should produce different hashes for different body top-level structures', () => {
      const headerNavMainFooter = `
        <html><body>
          <header></header>
          <nav></nav>
          <main></main>
          <footer></footer>
        </body></html>
      `;

      const divBased = `
        <html><body>
          <div class="header"></div>
          <div class="content"></div>
          <div class="footer"></div>
        </body></html>
      `;

      const result1 = computeTemplateSignature(headerNavMainFooter);
      const result2 = computeTemplateSignature(divBased);

      expect(result1!.signatureHash).not.toBe(result2!.signatureHash);
    });
  });

  describe('signature structure validation', () => {
    it('should correctly count landmark elements', () => {
      const html = `
        <html><body>
          <header>Header</header>
          <nav>Nav</nav>
          <main>
            <section>Section 1</section>
            <section>Section 2</section>
            <article>Article 1</article>
          </main>
          <footer>Footer</footer>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      
      const sig = result!.signatureJson;
      expect(sig.landmarkCounts.header).toBe(1);
      expect(sig.landmarkCounts.nav).toBe(1);
      expect(sig.landmarkCounts.main).toBe(1);
      expect(sig.landmarkCounts.section).toBe(2);
      expect(sig.landmarkCounts.article).toBe(1);
      expect(sig.landmarkCounts.footer).toBe(1);
    });

    it('should correctly count form elements', () => {
      const html = `
        <html><body>
          <form>
            <input type="text">
            <input type="email">
            <input type="password">
            <select><option>A</option></select>
            <textarea></textarea>
            <button type="submit">Submit</button>
          </form>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      
      const sig = result!.signatureJson;
      expect(sig.formElements.input).toBe(3);
      expect(sig.formElements.select).toBe(1);
      expect(sig.formElements.textarea).toBe(1);
      expect(sig.formElements.button).toBe(1);
      expect(sig.landmarkCounts.form).toBe(1);
    });

    it('should correctly count links', () => {
      const html = `
        <html><body>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </nav>
          <main>
            <p><a href="/page1">Link 1</a></p>
            <p><a href="/page2">Link 2</a></p>
          </main>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      expect(result!.signatureJson.linkStats.totalLinks).toBe(5);
    });

    it('should extract body top-level tags', () => {
      const html = `
        <html><body>
          <header>Header</header>
          <nav>Nav</nav>
          <main>Main</main>
          <aside>Aside</aside>
          <footer>Footer</footer>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      expect(result!.signatureJson.bodyTopLevelTags).toEqual([
        'header', 'nav', 'main', 'aside', 'footer'
      ]);
    });

    it('should capture class tokens (cleaned and sorted)', () => {
      const html = `
        <html><body>
          <div class="container main-wrapper">
            <header class="site-header">
              <nav class="navigation primary-nav"></nav>
            </header>
          </div>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      
      const tokens = result!.signatureJson.classTokensSample;
      expect(tokens).toContain('container');
      expect(tokens).toContain('main-wrapper');
      expect(tokens).toContain('site-header');
      expect(tokens).toContain('navigation');
      expect(tokens).toContain('primary-nav');
      // Tokens should be sorted
      expect(tokens).toEqual([...tokens].sort());
    });
  });

  describe('script and style stripping', () => {
    it('should ignore script content', () => {
      const withScript = `
        <html><body>
          <main><p>Content</p></main>
          <script>console.log("Script 1");</script>
        </body></html>
      `;

      const withDifferentScript = `
        <html><body>
          <main><p>Content</p></main>
          <script>alert("Different script");</script>
        </body></html>
      `;

      const result1 = computeTemplateSignature(withScript);
      const result2 = computeTemplateSignature(withDifferentScript);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });

    it('should ignore style content', () => {
      const withStyle = `
        <html><body>
          <style>.red { color: red; }</style>
          <main><p class="red">Content</p></main>
        </body></html>
      `;

      const withDifferentStyle = `
        <html><body>
          <style>.blue { color: blue; background: yellow; }</style>
          <main><p class="red">Content</p></main>
        </body></html>
      `;

      const result1 = computeTemplateSignature(withStyle);
      const result2 = computeTemplateSignature(withDifferentStyle);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });

    it('should ignore SVG elements', () => {
      const withSvg = `
        <html><body>
          <main>
            <svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>
            <p>Content</p>
          </main>
        </body></html>
      `;

      const withDifferentSvg = `
        <html><body>
          <main>
            <svg width="200" height="200"><rect width="100" height="100"/></svg>
            <p>Content</p>
          </main>
        </body></html>
      `;

      const result1 = computeTemplateSignature(withSvg);
      const result2 = computeTemplateSignature(withDifferentSvg);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });
  });

  describe('edge cases', () => {
    it('should return null for empty HTML', () => {
      const result = computeTemplateSignature('');
      // Empty string is handled by early bailout
      expect(result).toBeNull();
    });

    it('should handle HTML with only head (no body)', () => {
      const html = '<html><head><title>No Body</title></head></html>';
      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      expect(result!.signatureJson.bodyTopLevelTags).toEqual([]);
    });

    it('should handle deeply nested HTML', () => {
      // Generate deeply nested HTML (but not too deep to cause issues)
      let html = '<html><body>';
      for (let i = 0; i < 50; i++) {
        html += '<div>';
      }
      html += '<p>Deep content</p>';
      for (let i = 0; i < 50; i++) {
        html += '</div>';
      }
      html += '</body></html>';

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      expect(result!.signatureHash).toBeTruthy();
    });

    it('should handle malformed HTML gracefully', () => {
      const malformed = '<html><body><div><p>Unclosed tags<main>';
      const result = computeTemplateSignature(malformed);
      // Should not throw
      expect(result).not.toBeNull();
    });

    it('should filter out hash-like class tokens', () => {
      const html = `
        <html><body>
          <div class="real-class _abc123 a1b2c3d4e5f6 component valid-class"></div>
        </body></html>
      `;

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      
      const tokens = result!.signatureJson.classTokensSample;
      expect(tokens).toContain('real-class');
      expect(tokens).toContain('component');
      expect(tokens).toContain('valid-class');
      // Hash-like tokens should be filtered out
      expect(tokens).not.toContain('_abc123');
      expect(tokens).not.toContain('a1b2c3d4e5f6');
    });
  });

  describe('performance safeguards', () => {
    it('should return null for extremely large HTML (>5MB)', () => {
      // Generate HTML that exceeds 5MB
      const largeHtml = '<html><body>' + 'x'.repeat(6 * 1024 * 1024) + '</body></html>';
      
      const result = computeTemplateSignature(largeHtml);
      expect(result).toBeNull();
    });

    it('should handle large but valid HTML (under 5MB)', () => {
      // Generate HTML that's large but under the limit
      let html = '<html><body>';
      for (let i = 0; i < 1000; i++) {
        html += `<div class="item-${i}"><p>Content paragraph ${i}</p></div>`;
      }
      html += '</body></html>';
      
      // Should be well under 5MB
      expect(html.length).toBeLessThan(5 * 1024 * 1024);
      
      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      expect(result!.signatureHash).toBeTruthy();
    });

    it('should limit DOM skeleton sample size', () => {
      // Generate HTML with many elements
      let html = '<html><body>';
      for (let i = 0; i < 500; i++) {
        html += `<div class="item-${i}"><span>Item ${i}</span></div>`;
      }
      html += '</body></html>';

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      // Should be capped at MAX_SKELETON_ELEMENTS (150)
      expect(result!.signatureJson.domSkeletonSample.length).toBeLessThanOrEqual(150);
    });

    it('should limit class tokens sample size', () => {
      // Generate HTML with many unique classes
      let html = '<html><body>';
      for (let i = 0; i < 100; i++) {
        html += `<div class="unique-class-${i}">Item</div>`;
      }
      html += '</body></html>';

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      // Should be capped at MAX_CLASS_TOKENS (15)
      expect(result!.signatureJson.classTokensSample.length).toBeLessThanOrEqual(15);
    });

    it('should limit path depth in DOM skeleton', () => {
      // Generate deeply nested HTML
      let html = '<html><body>';
      for (let i = 0; i < 50; i++) {
        html += '<div>';
      }
      html += '<p>Deep content</p>';
      for (let i = 0; i < 50; i++) {
        html += '</div>';
      }
      html += '</body></html>';

      const result = computeTemplateSignature(html);
      expect(result).not.toBeNull();
      
      // Check that paths in domSkeletonSample don't exceed MAX_PATH_DEPTH (20)
      for (const path of result!.signatureJson.domSkeletonSample) {
        const depth = path.split('>').length;
        expect(depth).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('determinism', () => {
    it('should produce identical results on repeated calls', () => {
      const html = `
        <html><body>
          <header><nav></nav></header>
          <main><article><p>Content</p></article></main>
          <footer></footer>
        </body></html>
      `;

      const results: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = computeTemplateSignature(html);
        results.push(result!.signatureHash);
      }

      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });

    it('should produce same hash regardless of whitespace differences', () => {
      const compact = '<html><body><header></header><main><p>Content</p></main><footer></footer></body></html>';
      
      const spaced = `
        <html>
          <body>
            <header></header>
            <main>
              <p>Content</p>
            </main>
            <footer></footer>
          </body>
        </html>
      `;

      const result1 = computeTemplateSignature(compact);
      const result2 = computeTemplateSignature(spaced);

      expect(result1!.signatureHash).toBe(result2!.signatureHash);
    });
  });
});
