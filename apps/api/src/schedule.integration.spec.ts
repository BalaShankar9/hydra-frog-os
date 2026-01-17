import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';

describe('Schedule Endpoints Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let adminToken: string;
  let memberToken: string;
  let viewerToken: string;
  let orgId: string;
  let projectId: string;

  const adminEmail = `sched-admin-${Date.now()}@test.com`;
  const memberEmail = `sched-member-${Date.now()}@test.com`;
  const viewerEmail = `sched-viewer-${Date.now()}@test.com`;
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
      .send({ name: 'Schedule Test Org' });
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
        name: 'Schedule Test Project',
        domain: 'schedule-test.com',
        startUrl: 'https://schedule-test.com/',
      });
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (projectId) {
      await prisma.crawlSchedule.deleteMany({ where: { projectId } }).catch(() => {});
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

  describe('GET /projects/:projectId/schedule', () => {
    it('returns default schedule when none exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.projectId).toBe(projectId);
      expect(res.body.enabled).toBe(false);
      expect(res.body.frequency).toBe('MANUAL');
      expect(res.body.nextRunAt).toBeNull();
    });

    it('viewer can get schedule', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.projectId).toBe(projectId);
    });
  });

  describe('PATCH /projects/:projectId/schedule', () => {
    it('admin can enable daily schedule', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true, frequency: 'DAILY' })
        .expect(200);

      expect(res.body.projectId).toBe(projectId);
      expect(res.body.enabled).toBe(true);
      expect(res.body.frequency).toBe('DAILY');
      expect(res.body.nextRunAt).toBeTruthy();

      // nextRunAt should be approximately 24 hours from now
      const nextRun = new Date(res.body.nextRunAt);
      const now = new Date();
      const diffHours = (nextRun.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    });

    it('member can update schedule', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ enabled: true, frequency: 'WEEKLY' })
        .expect(200);

      expect(res.body.frequency).toBe('WEEKLY');

      // nextRunAt should be approximately 7 days from now
      const nextRun = new Date(res.body.nextRunAt);
      const now = new Date();
      const diffDays = (nextRun.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });

    it('viewer cannot update schedule (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ enabled: true, frequency: 'DAILY' })
        .expect(403);
    });

    it('can disable schedule', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false, frequency: 'DAILY' })
        .expect(200);

      expect(res.body.enabled).toBe(false);
      expect(res.body.nextRunAt).toBeNull();
    });

    it('validates frequency enum', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true, frequency: 'INVALID' })
        .expect(400);
    });

    it('manual frequency sets nextRunAt to null', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true, frequency: 'MANUAL' })
        .expect(200);

      expect(res.body.enabled).toBe(true);
      expect(res.body.frequency).toBe('MANUAL');
      expect(res.body.nextRunAt).toBeNull();
    });
  });

  describe('GET /projects/:projectId/schedule (after updates)', () => {
    it('returns updated schedule', async () => {
      // First set a schedule
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true, frequency: 'DAILY' });

      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.enabled).toBe(true);
      expect(res.body.frequency).toBe('DAILY');
      expect(res.body.nextRunAt).toBeTruthy();
    });
  });
});
