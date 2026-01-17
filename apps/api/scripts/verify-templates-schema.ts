/**
 * Verification script for Phase 2A: Template Clustering schema
 * 
 * This script verifies that:
 * 1. The Template model exists and can be queried
 * 2. The Page model has template-related fields
 * 3. The relations are set up correctly
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 2A: Template Clustering Schema Verification');
  console.log('='.repeat(60));
  console.log();

  // 1. Check if we can query CrawlRuns
  console.log('1. Querying CrawlRuns...');
  const crawlRuns = await prisma.crawlRun.findMany({
    take: 5,
    include: {
      project: { select: { name: true } },
      _count: { select: { pages: true, templates: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`   Found ${crawlRuns.length} crawl run(s)`);
  
  for (const run of crawlRuns) {
    console.log(`   - ${run.id}: ${run.project.name} (${run.status})`);
    console.log(`     Pages: ${run._count.pages}, Templates: ${run._count.templates}`);
  }
  console.log();

  // 2. Check Template model
  console.log('2. Querying Templates...');
  const templates = await prisma.template.findMany({
    take: 5,
    include: {
      _count: { select: { pages: true } }
    }
  });

  console.log(`   Found ${templates.length} template(s)`);
  for (const template of templates) {
    console.log(`   - ${template.id}: ${template.name} (${template._count.pages} pages)`);
    console.log(`     Signature hash: ${template.signatureHash}`);
  }
  console.log();

  // 3. Check Page model has template fields
  console.log('3. Querying Pages with template fields...');
  const pages = await prisma.page.findMany({
    take: 3,
    select: {
      id: true,
      url: true,
      statusCode: true,
      templateSignatureHash: true,
      templateSignatureJson: true,
      templateId: true,
      template: {
        select: { id: true, name: true }
      }
    },
    orderBy: { discoveredAt: 'desc' }
  });

  console.log(`   Found ${pages.length} page(s)`);
  for (const page of pages) {
    console.log(`   - ${page.url}`);
    console.log(`     Status: ${page.statusCode}`);
    console.log(`     templateSignatureHash: ${page.templateSignatureHash ?? 'null'}`);
    console.log(`     templateSignatureJson: ${page.templateSignatureJson ? 'present' : 'null'}`);
    console.log(`     templateId: ${page.templateId ?? 'null'}`);
    console.log(`     template: ${page.template ? page.template.name : 'null'}`);
  }
  console.log();

  // 4. Verify schema structure
  console.log('4. Schema Structure Verification...');
  
  // Test creating a template (we'll roll back)
  const testCrawlRun = crawlRuns[0];
  if (testCrawlRun) {
    console.log(`   Testing template creation for crawl run ${testCrawlRun.id}...`);
    
    // Create a test template
    const testTemplate = await prisma.template.create({
      data: {
        crawlRunId: testCrawlRun.id,
        name: 'Test Template',
        signatureHash: 'test-hash-' + Date.now(),
        signatureJson: { elements: ['header', 'nav', 'main', 'footer'] },
        pageCount: 0
      }
    });
    console.log(`   ✅ Template created: ${testTemplate.id}`);
    
    // Clean up test template
    await prisma.template.delete({ where: { id: testTemplate.id } });
    console.log('   ✅ Template deleted (cleanup)');
  } else {
    console.log('   ⚠️  No crawl runs found to test template creation');
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('✅ Phase 2A Schema Verification PASSED');
  console.log('='.repeat(60));
  console.log();
  console.log('New models and fields available:');
  console.log('  - Template model with: id, crawlRunId, name, signatureHash, signatureJson, samplePageId, pageCount');
  console.log('  - Page.templateSignatureHash (String?)');
  console.log('  - Page.templateSignatureJson (Json?)');
  console.log('  - Page.templateId (String?)');
  console.log('  - Page.template relation (Template?)');
  console.log();
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
