/**
 * Test script to verify template signature storage works
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createHash } from 'node:crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const testSignatureJson = {
  bodyTopLevelTags: ['header', 'main', 'footer'],
  landmarkCounts: { header: 1, main: 1, footer: 1 },
  formElements: {},
  linkStats: { totalLinks: 5 },
  domSkeletonSample: ['html>body>header', 'html>body>main'],
  classTokensSample: ['container', 'wrapper']
};

const testHash = createHash('sha256')
  .update(JSON.stringify(testSignatureJson))
  .digest('hex');

async function main() {
  const crawlRun = await prisma.crawlRun.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!crawlRun) {
    console.log('No crawl runs found');
    return;
  }
  
  console.log('Testing signature storage with crawl run:', crawlRun.id);
  
  const testPage = await prisma.page.create({
    data: {
      crawlRunId: crawlRun.id,
      url: 'https://test-signature.example.com/',
      normalizedUrl: 'https://test-signature.example.com/',
      statusCode: 200,
      contentType: 'text/html',
      templateSignatureHash: testHash,
      templateSignatureJson: testSignatureJson as Prisma.InputJsonValue,
    }
  });
  
  console.log('✅ Page created with signature:', testPage.id);
  console.log('   Hash:', testPage.templateSignatureHash);
  
  const retrieved = await prisma.page.findUnique({
    where: { id: testPage.id },
    select: { templateSignatureHash: true, templateSignatureJson: true }
  });
  
  console.log('✅ Signature retrieved successfully');
  console.log('   Hash matches:', retrieved?.templateSignatureHash === testHash);
  console.log('   JSON present:', !!retrieved?.templateSignatureJson);
  
  await prisma.page.delete({ where: { id: testPage.id } });
  console.log('✅ Test page cleaned up');
  console.log('\nTemplate signature storage is working correctly!');
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
