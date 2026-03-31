/**
 * Integration tests for Template API endpoints
 * 
 * Tests:
 * - GET /crawls/:crawlRunId/templates - List templates with aggregates
 * - GET /templates/:templateId - Get template detail
 * - GET /templates/:templateId/pages - List pages in template
 * - GET /templates/:templateId/issues - List issues in template
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';
import { IssueSeverity } from '@prisma/client';

describe('Template Endpoints Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let adminToken: string;
  let orgId: string;
  let projectId: string;
  let crawlRunId: string;
  let template1Id: string;
  let template2Id: string;

  const adminEmail = `template-admin-${Date.now()}@test.com`;
  const testPassword = 'password123';

  // Signature hashes for our two test templates
  const BLOG_TEMPLATE_HASH = 'blog-template-hash-001';
  const PRODUCT_TEMPLATE_HASH = 'product-template-hash-002';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create user
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: adminEmail, password: testPassword });
    adminToken = adminRes.body.accessToken;

    // Setup: Create org
    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Template Test Org' });
    orgId = orgRes.body.id;

    // Setup: Create project
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orgId,
        name: 'Template Test Project',
        domain: 'template-test.com',
        startUrl: 'https://template-test.com/',
      });
    projectId = projectRes.body.id;

    // Setup: Create crawl run (status DONE so we can test templates)
    const crawlRun = await prisma.crawlRun.create({
      data: {
        projectId,
        status: 'DONE',
        startedAt: new Date(),
        finishedAt: new Date(),
        settingsSnapshotJson: {},
        totalsJson: {},
      },
    });
    crawlRunId = crawlRun.id;

    // Create Template 1: Blog Template (3 pages)
    const template1 = await prisma.template.create({
      data: {
        crawlRunId,
        name: 'Blog Template',
        signatureHash: BLOG_TEMPLATE_HASH,
        signatureJson: { bodyTopLevelTags: ['header', 'main', 'footer'] },
        pageCount: 3,
      },
    });
    template1Id = template1.id;

    // Create Template 2: Product Template (2 pages)
    const template2 = await prisma.template.create({
      data: {
        crawlRunId,
        name: 'Product Template',
        signatureHash: PRODUCT_TEMPLATE_HASH,
        signatureJson: { bodyTopLevelTags: ['header', 'main', 'aside', 'footer'] },
        pageCount: 2,
      },
    });
    template2Id = template2.id;

    // Create pages for Template 1
    const page1 = await prisma.page.create({
      data: {
        crawlRunId,
        templateId: template1Id,
        url: 'https://template-test.com/blog/post-1',
        normalizedUrl: 'https://template-test.com/blog/post-1',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Blog Post 1',
        templateSignatureHash: BLOG_TEMPLATE_HASH,
        templateSignatureJson: {},
      },
    });

    const page2 = await prisma.page.create({
      data: {
        crawlRunId,
        templateId: template1Id,
        url: 'https://template-test.com/blog/post-2',
        normalizedUrl: 'https://template-test.com/blog/post-2',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Blog Post 2',
        templateSignatureHash: BLOG_TEMPLATE_HASH,
        templateSignatureJson: {},
      },
    });

    const page3 = await prisma.page.create({
      data: {
        crawlRunId,
        templateId: template1Id,
        url: 'https://template-test.com/blog/post-3',
        normalizedUrl: 'https://template-test.com/blog/post-3',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Blog Post 3',
        templateSignatureHash: BLOG_TEMPLATE_HASH,
        templateSignatureJson: {},
      },
    });

    // Create pages for Template 2
    const page4 = await prisma.page.create({
      data: {
        crawlRunId,
        templateId: template2Id,
        url: 'https://template-test.com/product/widget',
        normalizedUrl: 'https://template-test.com/product/widget',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Widget Product',
        templateSignatureHash: PRODUCT_TEMPLATE_HASH,
        templateSignatureJson: {},
      },
    });

    const page5 = await prisma.page.create({
      data: {
        crawlRunId,
        templateId: template2Id,
        url: 'https://template-test.com/product/gadget',
        normalizedUrl: 'https://template-test.com/product/gadget',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Gadget Product',
        templateSignatureHash: PRODUCT_TEMPLATE_HASH,
        templateSignatureJson: {},
      },
    });

    // Update template sample page IDs
    await prisma.template.update({
      where: { id: template1Id },
      data: { samplePageId: page1.id },
    });
    await prisma.template.update({
      where: { id: template2Id },
      data: { samplePageId: page4.id },
    });

    // Create issues for Template 1 pages (5 total: 2 HIGH, 2 MEDIUM, 1 LOW)
    await prisma.issue.createMany({
      data: [
        {
          crawlRunId,
          pageId: page1.id,
          type: 'MISSING_META_DESCRIPTION',
          severity: IssueSeverity.HIGH,
          title: 'Missing meta description',
          description: 'Page lacks meta description',
          recommendation: 'Add meta description',
        },
        {
          crawlRunId,
          pageId: page1.id,
          type: 'TITLE_TOO_LONG',
          severity: IssueSeverity.MEDIUM,
          title: 'Title too long',
          description: 'Title exceeds recommended length',
          recommendation: 'Shorten title',
        },
        {
          crawlRunId,
          pageId: page2.id,
          type: 'MISSING_META_DESCRIPTION',
          severity: IssueSeverity.HIGH,
          title: 'Missing meta description',
          description: 'Page lacks meta description',
          recommendation: 'Add meta description',
        },
        {
          crawlRunId,
          pageId: page2.id,
          type: 'MISSING_H1',
          severity: IssueSeverity.MEDIUM,
          title: 'Missing H1',
          description: 'Page has no H1 tag',
          recommendation: 'Add H1 tag',
        },
        {
          crawlRunId,
          pageId: page3.id,
          type: 'THIN_CONTENT',
          severity: IssueSeverity.LOW,
          title: 'Thin content',
          description: 'Page has very little content',
          recommendation: 'Add more content',
        },
      ],
    });

    // Create issues for Template 2 pages (2 total: 1 CRITICAL, 1 LOW)
    await prisma.issue.createMany({
      data: [
        {
          crawlRunId,
          pageId: page4.id,
          type: 'BROKEN_INTERNAL_LINK',
          severity: IssueSeverity.CRITICAL,
          title: 'Broken internal link',
          description: 'Links to non-existent page',
          recommendation: 'Fix or remove link',
        },
        {
          crawlRunId,
          pageId: page5.id,
          type: 'MISSING_ALT_TEXT',
          severity: IssueSeverity.LOW,
          title: 'Missing alt text',
          description: 'Image lacks alt text',
          recommendation: 'Add alt text',
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test data in correct order
    if (crawlRunId) {
      await prisma.issue.deleteMany({ where: { crawlRunId } }).catch(() => {});
      await prisma.link.deleteMany({ where: { crawlRunId } }).catch(() => {});
      await prisma.page.deleteMany({ where: { crawlRunId } }).catch(() => {});
      await prisma.template.deleteMany({ where: { crawlRunId } }).catch(() => {});
      await prisma.crawlRun.deleteMany({ where: { id: crawlRunId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (orgId) {
      await prisma.orgMember.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.org.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { email: adminEmail },
    }).catch(() => {});

    await app.close();
  });

  describe('GET /crawls/:crawlRunId/templates', () => {
    it('returns list of templates with correct counts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}/templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalTemplates).toBe(2);
      expect(res.body.items).toHaveLength(2);

      // Templates should be sorted by pageCount descending
      // Blog Template has 3 pages, Product Template has 2
      const blogTemplate = res.body.items.find((t: any) => t.name === 'Blog Template');
      const productTemplate = res.body.items.find((t: any) => t.name === 'Product Template');

      expect(blogTemplate).toBeDefined();
      expect(productTemplate).toBeDefined();

      // Verify Blog Template
      expect(blogTemplate.pageCount).toBe(3);
      expect(blogTemplate.issueCountTotal).toBe(5);
      expect(blogTemplate.severityCounts).toEqual({
        LOW: 1,
        MEDIUM: 2,
        HIGH: 2,
        CRITICAL: 0,
      });

      // Verify Product Template
      expect(productTemplate.pageCount).toBe(2);
      expect(productTemplate.issueCountTotal).toBe(2);
      expect(productTemplate.severityCounts).toEqual({
        LOW: 1,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 1,
      });
    });

    it('returns top issue types sorted by count', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}/templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const blogTemplate = res.body.items.find((t: any) => t.name === 'Blog Template');
      
      // MISSING_META_DESCRIPTION appears twice, should be first
      expect(blogTemplate.topIssueTypes.length).toBeGreaterThan(0);
      expect(blogTemplate.topIssueTypes[0].type).toBe('MISSING_META_DESCRIPTION');
      expect(blogTemplate.topIssueTypes[0].count).toBe(2);
    });

    it('includes sample URLs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}/templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const blogTemplate = res.body.items.find((t: any) => t.name === 'Blog Template');
      expect(blogTemplate.sampleUrl).toContain('/blog/');
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}/templates`)
        .expect(401);
    });

    it('returns 404 for non-existent crawl run', async () => {
      await request(app.getHttpServer())
        .get('/crawls/non-existent-id/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns empty array when no templates', async () => {
      // Create a crawl run with no templates
      const emptyCrawlRun = await prisma.crawlRun.create({
        data: {
          projectId,
          status: 'DONE',
          settingsSnapshotJson: {},
          totalsJson: {},
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/crawls/${emptyCrawlRun.id}/templates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalTemplates).toBe(0);
      expect(res.body.items).toEqual([]);

      // Cleanup
      await prisma.crawlRun.delete({ where: { id: emptyCrawlRun.id } });
    });
  });

  describe('GET /templates/:templateId', () => {
    it('returns template detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(template1Id);
      expect(res.body.name).toBe('Blog Template');
      expect(res.body.pageCount).toBe(3);
      expect(res.body.crawlRunId).toBe(crawlRunId);
      expect(res.body.sampleUrl).toContain('/blog/');
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .get(`/templates/${template1Id}`)
        .expect(401);
    });

    it('returns 404 for non-existent template', async () => {
      await request(app.getHttpServer())
        .get('/templates/non-existent-template-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /templates/:templateId/pages', () => {
    it('returns pages in template with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/pages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(3);

      // Verify page structure
      const page = res.body.items[0];
      expect(page).toHaveProperty('pageId');
      expect(page).toHaveProperty('url');
      expect(page).toHaveProperty('statusCode');
      expect(page).toHaveProperty('title');
    });

    it('supports search by URL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/pages?q=post-2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].url).toContain('post-2');
    });

    it('supports pagination', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/pages?page=1&pageSize=2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
    });

    it('returns empty for template with no pages', async () => {
      // Create empty template
      const emptyTemplate = await prisma.template.create({
        data: {
          crawlRunId,
          name: 'Empty Template',
          signatureHash: 'empty-hash',
          signatureJson: {},
          pageCount: 0,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/templates/${emptyTemplate.id}/pages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.items).toEqual([]);

      // Cleanup
      await prisma.template.delete({ where: { id: emptyTemplate.id } });
    });
  });

  describe('GET /templates/:templateId/issues', () => {
    it('returns issues for pages in template', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/issues`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(5);
      expect(res.body.items).toHaveLength(5);

      // Verify issue structure
      const issue = res.body.items[0];
      expect(issue).toHaveProperty('issueId');
      expect(issue).toHaveProperty('type');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('title');
      expect(issue).toHaveProperty('url');
    });

    it('supports severity filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/issues?severity=HIGH`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      res.body.items.forEach((issue: any) => {
        expect(issue.severity).toBe('HIGH');
      });
    });

    it('supports type filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/issues?type=MISSING_META_DESCRIPTION`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      res.body.items.forEach((issue: any) => {
        expect(issue.type).toBe('MISSING_META_DESCRIPTION');
      });
    });

    it('returns CRITICAL issues for Product Template', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template2Id}/issues?severity=CRITICAL`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].type).toBe('BROKEN_INTERNAL_LINK');
    });

    it('supports pagination', async () => {
      const res = await request(app.getHttpServer())
        .get(`/templates/${template1Id}/issues?page=1&pageSize=2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(5);
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe('Access control', () => {
    it('denies access to templates from other orgs', async () => {
      // Create another user and org
      const otherUserRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: `other-${Date.now()}@test.com`, password: testPassword });
      const otherToken = otherUserRes.body.accessToken;

      // Should not be able to access templates from our crawl run
      await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}/templates`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/templates/${template1Id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});
