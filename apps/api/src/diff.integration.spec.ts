/**
 * Integration tests for Crawl Diff API
 *
 * Tests:
 * - Create two crawl runs with pages
 * - Compute diff via POST /diffs/compare
 * - GET /diffs/:diffId returns expected summary
 * - GET /diffs/:diffId/items returns expected counts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';

describe('Diff API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let authToken: string;
  let orgId: string;
  let projectId: string;
  let crawlRun1Id: string;
  let crawlRun2Id: string;
  let diffId: string;

  const testEmail = `diff-test-${Date.now()}@test.com`;
  const testPassword = 'password123';

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

    // Create test user
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: testEmail, password: testPassword })
      .expect(201);
    authToken = signupRes.body.accessToken;

    // Create org
    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Diff Test Org' })
      .expect(201);
    orgId = orgRes.body.id;

    // Create project
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orgId,
        name: 'Diff Test Project',
        seedUrl: 'https://example.com',
        maxPages: 100,
      })
      .expect(201);
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (diffId) {
      await prisma.crawlDiffItem.deleteMany({ where: { diffId } }).catch(() => {});
      await prisma.crawlDiff.deleteMany({ where: { id: diffId } }).catch(() => {});
    }
    if (crawlRun2Id) {
      await prisma.page.deleteMany({ where: { crawlRunId: crawlRun2Id } }).catch(() => {});
      await prisma.crawlRun.deleteMany({ where: { id: crawlRun2Id } }).catch(() => {});
    }
    if (crawlRun1Id) {
      await prisma.page.deleteMany({ where: { crawlRunId: crawlRun1Id } }).catch(() => {});
      await prisma.crawlRun.deleteMany({ where: { id: crawlRun1Id } }).catch(() => {});
    }
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (orgId) {
      await prisma.org.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.user
      .deleteMany({ where: { email: testEmail } })
      .catch(() => {});

    await app.close();
  });

  describe('Setup - Create Crawl Runs with Pages', () => {
    it('should create first crawl run with pages (baseline)', async () => {
      // Create crawl run 1 directly in DB (simulating crawler worker)
      const run1 = await prisma.crawlRun.create({
        data: {
          projectId,
          status: 'DONE',
          totalsJson: { pagesDiscovered: 5, pagesCrawled: 5 },
          startedAt: new Date(Date.now() - 3600000), // 1 hour ago
          finishedAt: new Date(Date.now() - 3500000),
        },
      });
      crawlRun1Id = run1.id;

      // Create pages for run 1
      // Page 1: Normal page (will become 404)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun1Id,
          normalizedUrl: 'example.com/page1',
          url: 'https://example.com/page1',
          statusCode: 200,
          title: 'Page 1 Title',
          metaDescription: 'Page 1 description',
          robotsMeta: 'index, follow',
          h1Count: 1,
          wordCount: 500,
        },
      });

      // Page 2: Normal page (will get noindex)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun1Id,
          normalizedUrl: 'example.com/page2',
          url: 'https://example.com/page2',
          statusCode: 200,
          title: 'Page 2 Title',
          robotsMeta: 'index, follow',
          h1Count: 1,
          wordCount: 300,
        },
      });

      // Page 3: Missing title (will be fixed)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun1Id,
          normalizedUrl: 'example.com/page3',
          url: 'https://example.com/page3',
          statusCode: 200,
          title: null,
          h1Count: 0,
          wordCount: 200,
        },
      });

      // Page 4: Will be removed in run 2
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun1Id,
          normalizedUrl: 'example.com/removed',
          url: 'https://example.com/removed',
          statusCode: 200,
          title: 'Removed Page',
          h1Count: 1,
          wordCount: 100,
        },
      });

      // Page 5: Unchanged page
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun1Id,
          normalizedUrl: 'example.com/unchanged',
          url: 'https://example.com/unchanged',
          statusCode: 200,
          title: 'Unchanged Page',
          h1Count: 1,
          wordCount: 400,
        },
      });

      expect(crawlRun1Id).toBeDefined();
    });

    it('should create second crawl run with changes', async () => {
      // Create crawl run 2
      const run2 = await prisma.crawlRun.create({
        data: {
          projectId,
          status: 'DONE',
          totalsJson: { pagesDiscovered: 5, pagesCrawled: 5 },
          startedAt: new Date(Date.now() - 1800000), // 30 min ago
          finishedAt: new Date(Date.now() - 1700000),
        },
      });
      crawlRun2Id = run2.id;

      // Page 1: Now returns 404 (CRITICAL regression)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun2Id,
          normalizedUrl: 'example.com/page1',
          url: 'https://example.com/page1',
          statusCode: 404,
          title: null,
          h1Count: 0,
          wordCount: 0,
        },
      });

      // Page 2: Now has noindex (CRITICAL regression)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun2Id,
          normalizedUrl: 'example.com/page2',
          url: 'https://example.com/page2',
          statusCode: 200,
          title: 'Page 2 Title',
          robotsMeta: 'noindex, nofollow',
          h1Count: 1,
          wordCount: 300,
        },
      });

      // Page 3: Title fixed (HIGH improvement)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun2Id,
          normalizedUrl: 'example.com/page3',
          url: 'https://example.com/page3',
          statusCode: 200,
          title: 'Fixed Page 3 Title',
          h1Count: 1,
          wordCount: 200,
        },
      });

      // Page 4: REMOVED (not present in run 2) - HIGH regression

      // Page 5: Unchanged
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun2Id,
          normalizedUrl: 'example.com/unchanged',
          url: 'https://example.com/unchanged',
          statusCode: 200,
          title: 'Unchanged Page',
          h1Count: 1,
          wordCount: 400,
        },
      });

      // New page (improvement)
      await prisma.page.create({
        data: {
          crawlRunId: crawlRun2Id,
          normalizedUrl: 'example.com/new-page',
          url: 'https://example.com/new-page',
          statusCode: 200,
          title: 'Brand New Page',
          h1Count: 1,
          wordCount: 600,
        },
      });

      expect(crawlRun2Id).toBeDefined();
    });
  });

  describe('POST /diffs/compare', () => {
    it('should compute diff between two runs', async () => {
      const res = await request(app.getHttpServer())
        .post('/diffs/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          fromRunId: crawlRun1Id,
          toRunId: crawlRun2Id,
        })
        .expect(201);

      expect(res.body).toHaveProperty('diffId');
      expect(res.body).toHaveProperty('summaryJson');
      expect(res.body.isNew).toBe(true);

      diffId = res.body.diffId;

      // Verify summary counts
      const summary = res.body.summaryJson;
      expect(summary.totalItems).toBeGreaterThan(0);
      expect(summary.regressions).toBeGreaterThanOrEqual(3); // 404, noindex, removed
      expect(summary.improvements).toBeGreaterThanOrEqual(2); // title fixed, new page
    });

    it('should return existing diff on second call', async () => {
      const res = await request(app.getHttpServer())
        .post('/diffs/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          fromRunId: crawlRun1Id,
          toRunId: crawlRun2Id,
        })
        .expect(201);

      expect(res.body.diffId).toBe(diffId);
      expect(res.body.isNew).toBe(false);
    });

    it('should reject compare without auth', async () => {
      await request(app.getHttpServer())
        .post('/diffs/compare')
        .send({
          projectId,
          fromRunId: crawlRun1Id,
          toRunId: crawlRun2Id,
        })
        .expect(401);
    });
  });

  describe('GET /diffs/:diffId', () => {
    it('should return diff details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.diffId).toBe(diffId);
      expect(res.body.projectId).toBe(projectId);
      expect(res.body.fromRunId).toBe(crawlRun1Id);
      expect(res.body.toRunId).toBe(crawlRun2Id);
      expect(res.body.summaryJson).toBeDefined();
    });

    it('should return 404 for non-existent diff', async () => {
      await request(app.getHttpServer())
        .get('/diffs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /diffs/:diffId/items', () => {
    it('should return all diff items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=STATUS_CHANGED`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All items should be STATUS_CHANGED
      for (const item of res.body.items) {
        expect(item.type).toBe('STATUS_CHANGED');
      }
    });

    it('should filter by severity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?severity=CRITICAL`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All items should be CRITICAL
      for (const item of res.body.items) {
        expect(item.severity).toBe('CRITICAL');
      }
    });

    it('should filter by direction', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?direction=REGRESSION`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All items should be REGRESSION
      for (const item of res.body.items) {
        expect(item.direction).toBe('REGRESSION');
      }
    });

    it('should search by URL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?q=page1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All items should contain 'page1' in URL
      for (const item of res.body.items) {
        expect(item.url.toLowerCase()).toContain('page1');
      }
    });

    it('should paginate results', async () => {
      const res1 = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?page=1&pageSize=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res1.body.items.length).toBeLessThanOrEqual(2);

      if (res1.body.total > 2) {
        const res2 = await request(app.getHttpServer())
          .get(`/diffs/${diffId}/items?page=2&pageSize=2`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res2.body.items.length).toBeLessThanOrEqual(2);
        // Items should be different
        if (res2.body.items.length > 0) {
          expect(res2.body.items[0].id).not.toBe(res1.body.items[0].id);
        }
      }
    });
  });

  describe('GET /crawls/:runId/diff', () => {
    it('should return diff for a crawl run', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRun2Id}/diff`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.diffId).toBe(diffId);
      expect(res.body.toRunId).toBe(crawlRun2Id);
    });

    it('should return 404 for first run (no previous run to compare)', async () => {
      await request(app.getHttpServer())
        .get(`/crawls/${crawlRun1Id}/diff`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Verify Expected Diff Results', () => {
    it('should have detected 200->404 as CRITICAL regression', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=STATUS_CHANGED&q=page1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const statusChange = res.body.items.find(
        (i: { url: string }) => i.url.includes('page1'),
      );
      expect(statusChange).toBeDefined();
      expect(statusChange.severity).toBe('CRITICAL');
      expect(statusChange.direction).toBe('REGRESSION');
    });

    it('should have detected noindex added as CRITICAL regression', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=ROBOTS_CHANGED`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const robotsChange = res.body.items.find(
        (i: { url: string }) => i.url.includes('page2'),
      );
      expect(robotsChange).toBeDefined();
      expect(robotsChange.severity).toBe('CRITICAL');
      expect(robotsChange.direction).toBe('REGRESSION');
    });

    it('should have detected title fixed as HIGH improvement', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=TITLE_CHANGED`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const titleChange = res.body.items.find(
        (i: { url: string }) => i.url.includes('page3'),
      );
      expect(titleChange).toBeDefined();
      expect(titleChange.severity).toBe('HIGH');
      expect(titleChange.direction).toBe('IMPROVEMENT');
    });

    it('should have detected new URL as improvement', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=NEW_URL`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const newUrl = res.body.items.find(
        (i: { url: string }) => i.url.includes('new-page'),
      );
      expect(newUrl).toBeDefined();
      expect(newUrl.direction).toBe('IMPROVEMENT');
    });

    it('should have detected removed URL as regression', async () => {
      const res = await request(app.getHttpServer())
        .get(`/diffs/${diffId}/items?type=REMOVED_URL`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const removedUrl = res.body.items.find(
        (i: { url: string }) => i.url.includes('removed'),
      );
      expect(removedUrl).toBeDefined();
      expect(removedUrl.severity).toBe('HIGH');
      expect(removedUrl.direction).toBe('REGRESSION');
    });
  });
});
