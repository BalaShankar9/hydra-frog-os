/**
 * Test script for template signature generation
 */

import { computeTemplateSignature } from './computeTemplateSignature.js';

const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>.test { color: red; }</style>
  <script>console.log('test');</script>
</head>
<body>
  <header class="main-header site-header">
    <nav class="primary-nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>
  <main>
    <section class="hero-section">
      <h1>Welcome</h1>
      <p>This is a test page.</p>
    </section>
    <article class="blog-post">
      <h2>Article Title</h2>
      <p>Article content goes here.</p>
      <form action="/submit" method="post">
        <input type="text" name="name" />
        <input type="email" name="email" />
        <textarea name="message"></textarea>
        <button type="submit">Submit</button>
      </form>
    </article>
  </main>
  <footer class="site-footer">
    <p>&copy; 2025</p>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </footer>
</body>
</html>
`;

console.log('Testing template signature computation...\n');

const result = computeTemplateSignature(testHtml);

if (result) {
  console.log('✅ Signature computed successfully!\n');
  console.log('Hash:', result.signatureHash);
  console.log('\nSignature JSON:');
  console.log(JSON.stringify(result.signatureJson, null, 2));
  
  // Verify determinism - compute again
  const result2 = computeTemplateSignature(testHtml);
  if (result2 && result2.signatureHash === result.signatureHash) {
    console.log('\n✅ Signature is deterministic (same hash on re-computation)');
  } else {
    console.log('\n❌ Signature is NOT deterministic!');
  }
  
  // Verify different HTML produces different hash
  const differentHtml = testHtml.replace('<nav', '<div').replace('</nav>', '</div>');
  const result3 = computeTemplateSignature(differentHtml);
  if (result3 && result3.signatureHash !== result.signatureHash) {
    console.log('✅ Different structure produces different hash');
  } else {
    console.log('❌ Different structure produced same hash!');
  }
  
} else {
  console.log('❌ Failed to compute signature');
  process.exit(1);
}
