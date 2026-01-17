import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';

describe('Crawl Endpoints Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let adminToken: string;
  let memberToken: string;
  let viewerToken: string;
  let orgId: string;
  let projectId: string;
  let crawlRunId: string;

  const adminEmail = `crawl-admin-${Date.now()}@test.com`;
  const memberEmail = `crawl-member-${Date.now()}@test.com`;
  const viewerEmail = `crawl-viewer-${Date.now()}@test.com`;
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

    // Setup: Create users
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: adminEmail, password: testPassword });
    adminToken = adminRes.body.accessToken;

    const memberRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: memberEmail, password: testPassword });
    memberToken = memberRes.body.accessToken;

    const viewerRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: viewerEmail, password: testPassword });
    viewerToken = viewerRes.body.accessToken;

    // Setup: Create org
    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Crawl Test Org' });
    orgId = orgRes.body.id;

    // Add member and viewer to org
    await request(app.getHttpServer())
      .post(`/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' });

    await request(app.getHttpServer())
      .post(`/orgs/${orgId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: viewerEmail, role: 'VIEWER' });

    // Setup: Create project
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orgId,
        name: 'Crawl Test Project',
        domain: 'crawl-test.com',
        startUrl: 'https://crawl-test.com/',
      });
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (projectId) {
      await prisma.crawlRun.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (orgId) {
      await prisma.orgMember.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.org.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail, viewerEmail] } },
    }).catch(() => {});

    await app.close();
  });

  describe('POST /projects/:projectId/crawls/run-now', () => {
    it('admin can start crawl', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/run-now`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('crawlRunId');
      expect(res.body.status).toBe('QUEUED');
      crawlRunId = res.body.crawlRunId;
    });

    it('prevents concurrent runs (409)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/run-now`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect(res.body.error).toBe('Conflict');
    });

    it('viewer cannot start crawl (403)', async () => {
      // First cancel existing crawl
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/run-now`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('member can start crawl', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/run-now`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);

      expect(res.body.status).toBe('QUEUED');
      crawlRunId = res.body.crawlRunId;
    });
  });

  describe('GET /projects/:projectId/crawls', () => {
    it('lists crawl runs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/crawls`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('viewer can list crawls', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/crawls`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /crawls/:crawlRunId', () => {
    it('gets crawl details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(crawlRunId);
      expect(res.body.projectId).toBe(projectId);
      expect(res.body).toHaveProperty('settingsSnapshotJson');
    });

    it('viewer can get crawl details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/crawls/${crawlRunId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.id).toBe(crawlRunId);
    });
  });

  describe('POST /projects/:projectId/crawls/cancel', () => {
    it('viewer cannot cancel crawl (403)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/cancel`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({})
        .expect(403);
    });

    it('member can cancel crawl', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.newStatus).toBe('CANCELED');
    });

    it('returns 404 when no active crawl', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404);
    });

    it('can cancel by specific crawlRunId', async () => {
      // Start a new crawl
      const runRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/run-now`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const newCrawlRunId = runRes.body.crawlRunId;

      // Cancel by specific ID
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/crawls/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ crawlRunId: newCrawlRunId })
        .expect(200);

      expect(res.body.crawlRunId).toBe(newCrawlRunId);
      expect(res.body.newStatus).toBe('CANCELED');
    });
  });
});
