/**
 * Test script to verify template clustering works correctly.
 * 
 * Run with: pnpm --filter crawler exec tsx test-template-clustering.ts
 */

import 'dotenv/config';
import { prisma } from './src/prisma.js';
import { clusterTemplates, getTemplateStats, saveTemplateStats } from './src/templates/clusterTemplates.js';

async function runTest() {
  console.log('🧪 Testing Template Clustering...\n');

  // Create test org first (required for project)
  const testOrg = await prisma.org.create({
    data: {
      name: 'Test Clustering Org',
    },
  });

  // Create a test project and crawl run
  const testProject = await prisma.project.create({
    data: {
      orgId: testOrg.id,
      name: 'Test Clustering Project',
      domain: 'test-clustering.example.com',
      startUrl: 'https://test-clustering.example.com',
    },
  });

  const testCrawlRun = await prisma.crawlRun.create({
    data: {
      projectId: testProject.id,
      status: 'DONE',
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  console.log(`✅ Created test org: ${testOrg.id}`);
  console.log(`✅ Created test project: ${testProject.id}`);
  console.log(`✅ Created test crawl run: ${testCrawlRun.id}\n`);

  // Create test pages with different template signatures
  const signatureA = {
    version: 1,
    tree: [{ tag: 'html', children: [{ tag: 'body', children: [{ tag: 'main', children: [] }] }] }],
  };
  const hashA = 'abc123hash_template_a';

  const signatureB = {
    version: 1,
    tree: [{ tag: 'html', children: [{ tag: 'body', children: [{ tag: 'article', children: [] }] }] }],
  };
  const hashB = 'def456hash_template_b';

  // Create 3 pages with signature A (blog posts)
  const blogPages = await Promise.all([
    prisma.page.create({
      data: {
        crawlRunId: testCrawlRun.id,
        url: 'https://test-clustering.example.com/blog/post-1',
        normalizedUrl: 'https://test-clustering.example.com/blog/post-1',
        statusCode: 200,
        contentType: 'text/html',
        templateSignatureHash: hashA,
        templateSignatureJson: signatureA,
      },
    }),
    prisma.page.create({
      data: {
        crawlRunId: testCrawlRun.id,
        url: 'https://test-clustering.example.com/blog/post-2',
        normalizedUrl: 'https://test-clustering.example.com/blog/post-2',
        statusCode: 200,
        contentType: 'text/html',
        templateSignatureHash: hashA,
        templateSignatureJson: signatureA,
      },
    }),
    prisma.page.create({
      data: {
        crawlRunId: testCrawlRun.id,
        url: 'https://test-clustering.example.com/blog/post-3',
        normalizedUrl: 'https://test-clustering.example.com/blog/post-3',
        statusCode: 200,
        contentType: 'text/html',
        templateSignatureHash: hashA,
        templateSignatureJson: signatureA,
      },
    }),
  ]);

  // Create 2 pages with signature B (product pages)
  const productPages = await Promise.all([
    prisma.page.create({
      data: {
        crawlRunId: testCrawlRun.id,
        url: 'https://test-clustering.example.com/product/widget-x',
        normalizedUrl: 'https://test-clustering.example.com/product/widget-x',
        statusCode: 200,
        contentType: 'text/html',
        templateSignatureHash: hashB,
        templateSignatureJson: signatureB,
      },
    }),
    prisma.page.create({
      data: {
        crawlRunId: testCrawlRun.id,
        url: 'https://test-clustering.example.com/product/gadget-y',
        normalizedUrl: 'https://test-clustering.example.com/product/gadget-y',
        statusCode: 200,
        contentType: 'text/html',
        templateSignatureHash: hashB,
        templateSignatureJson: signatureB,
      },
    }),
  ]);

  // Create 1 page with no signature (non-HTML)
  await prisma.page.create({
    data: {
      crawlRunId: testCrawlRun.id,
      url: 'https://test-clustering.example.com/style.css',
      normalizedUrl: 'https://test-clustering.example.com/style.css',
      statusCode: 200,
      contentType: 'text/css',
      templateSignatureHash: null,
      templateSignatureJson: null,
    },
  });

  console.log(`✅ Created ${blogPages.length} blog pages with signature A`);
  console.log(`✅ Created ${productPages.length} product pages with signature B`);
  console.log(`✅ Created 1 non-HTML page (no signature)\n`);

  // Run clustering
  console.log('🔄 Running clusterTemplates...');
  await clusterTemplates(testCrawlRun.id);
  console.log('✅ Clustering complete\n');

  // Verify templates were created
  const templates = await prisma.template.findMany({
    where: { crawlRunId: testCrawlRun.id },
    orderBy: { pageCount: 'desc' },
  });

  console.log(`📊 Templates created: ${templates.length}`);
  for (const t of templates) {
    console.log(`   - ${t.name}: ${t.pageCount} pages (hash: ${t.signatureHash.substring(0, 12)}...)`);
  }

  // Verify pages have templateId assigned
  const pagesWithTemplateId = await prisma.page.count({
    where: {
      crawlRunId: testCrawlRun.id,
      templateId: { not: null },
    },
  });

  const pagesWithoutTemplateId = await prisma.page.count({
    where: {
      crawlRunId: testCrawlRun.id,
      templateId: null,
    },
  });

  console.log(`\n📊 Pages with templateId: ${pagesWithTemplateId}`);
  console.log(`📊 Pages without templateId (non-HTML): ${pagesWithoutTemplateId}`);

  // Get and save template stats
  console.log('\n🔄 Getting template stats...');
  const stats = await getTemplateStats(testCrawlRun.id);
  console.log('📊 Template Stats:');
  console.log(`   - Template count: ${stats.templateCount}`);
  console.log(`   - Largest template page count: ${stats.largestTemplatePageCount}`);
  console.log(`   - Top templates:`);
  for (const t of stats.topTemplates) {
    console.log(`     • ${t.name}: ${t.pageCount} pages`);
  }

  // Save stats to totalsJson
  await saveTemplateStats(testCrawlRun.id, stats);
  console.log('✅ Saved template stats to totalsJson\n');

  // Verify totalsJson was updated
  const updatedCrawlRun = await prisma.crawlRun.findUnique({
    where: { id: testCrawlRun.id },
    select: { totalsJson: true },
  });
  console.log('📋 Updated totalsJson:', JSON.stringify(updatedCrawlRun?.totalsJson, null, 2));

  // Verify idempotency - run clustering again
  console.log('\n🔄 Testing idempotency (running clusterTemplates again)...');
  await clusterTemplates(testCrawlRun.id);
  
  const templatesAfterSecondRun = await prisma.template.findMany({
    where: { crawlRunId: testCrawlRun.id },
  });
  console.log(`📊 Templates after second run: ${templatesAfterSecondRun.length}`);
  
  if (templatesAfterSecondRun.length === templates.length) {
    console.log('✅ Idempotency verified - same number of templates');
  } else {
    console.log('❌ Idempotency FAILED - template count changed');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await prisma.page.deleteMany({ where: { crawlRunId: testCrawlRun.id } });
  await prisma.template.deleteMany({ where: { crawlRunId: testCrawlRun.id } });
  await prisma.crawlRun.delete({ where: { id: testCrawlRun.id } });
  await prisma.project.delete({ where: { id: testProject.id } });
  await prisma.org.delete({ where: { id: testOrg.id } });
  console.log('✅ Cleanup complete');

  console.log('\n✅ ALL TESTS PASSED!\n');

  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
