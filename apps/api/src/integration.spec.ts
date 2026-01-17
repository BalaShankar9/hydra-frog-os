import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';

describe('API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let adminToken: string;
  let memberToken: string;
  let viewerToken: string;
  let orgId: string;
  let projectId: string;

  const adminEmail = `admin-${Date.now()}@test.com`;
  const memberEmail = `member-${Date.now()}@test.com`;
  const viewerEmail = `viewer-${Date.now()}@test.com`;
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
  });

  afterAll(async () => {
    // Cleanup test data
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (orgId) {
      await prisma.org.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail, viewerEmail] } },
    }).catch(() => {});

    await app.close();
  });

  describe('Auth Endpoints', () => {
    it('POST /auth/signup - should create admin user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: adminEmail, password: testPassword })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(adminEmail);
      adminToken = res.body.accessToken;
    });

    it('POST /auth/signup - should create member user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: memberEmail, password: testPassword })
        .expect(201);

      memberToken = res.body.accessToken;
    });

    it('POST /auth/signup - should create viewer user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: viewerEmail, password: testPassword })
        .expect(201);

      viewerToken = res.body.accessToken;
    });

    it('POST /auth/login - should login and return token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: adminEmail, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(adminEmail);
    });

    it('GET /auth/me - should return current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.email).toBe(adminEmail);
    });

    it('GET /auth/me - should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  describe('Org Endpoints', () => {
    it('POST /orgs - should create org and set user as ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Org' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Org');
      expect(res.body.members[0].role).toBe('ADMIN');
      orgId = res.body.id;
    });

    it('GET /orgs - should list user orgs', async () => {
      const res = await request(app.getHttpServer())
        .get('/orgs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((o: { id: string }) => o.id === orgId)).toBe(true);
    });

    it('POST /orgs/:orgId/members - admin can add member', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: memberEmail, role: 'MEMBER' })
        .expect(201);

      expect(res.body.email).toBe(memberEmail);
      expect(res.body.role).toBe('MEMBER');
    });

    it('POST /orgs/:orgId/members - admin can add viewer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: viewerEmail, role: 'VIEWER' })
        .expect(201);

      expect(res.body.email).toBe(viewerEmail);
      expect(res.body.role).toBe('VIEWER');
    });

    it('GET /orgs/:orgId/members - member can view members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3); // admin, member, viewer
    });

    it('POST /orgs/:orgId/members - member cannot add members', async () => {
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: 'another@test.com', role: 'VIEWER' })
        .expect(403);
    });
  });

  describe('Project Endpoints', () => {
    it('POST /projects - admin can create project', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orgId,
          name: 'Test Project',
          domain: 'example.com',
          startUrl: 'https://example.com/',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Project');
      expect(res.body.domain).toBe('example.com');
      projectId = res.body.id;
    });

    it('POST /projects - member can create project', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          orgId,
          name: 'Member Project',
          domain: 'member-site.com',
          startUrl: 'https://member-site.com/',
        })
        .expect(201);

      expect(res.body.name).toBe('Member Project');
      // Clean up this project
      await prisma.project.delete({ where: { id: res.body.id } });
    });

    it('POST /projects - viewer cannot create project', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          orgId,
          name: 'Viewer Project',
          domain: 'viewer-site.com',
          startUrl: 'https://viewer-site.com/',
        })
        .expect(403);
    });

    it('POST /projects - validation: domain must not have protocol', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orgId,
          name: 'Bad Domain',
          domain: 'https://example.com',
          startUrl: 'https://example.com/',
        })
        .expect(400);

      expect(res.body.message[0]).toContain('Domain must be a valid domain without protocol');
    });

    it('POST /projects - validation: startUrl must have https', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orgId,
          name: 'Bad URL',
          domain: 'example.com',
          startUrl: 'http://example.com/',
        })
        .expect(400);

      expect(res.body.message).toContain('startUrl must be a valid URL with https://');
    });

    it('GET /projects?orgId= - should list projects', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects?orgId=${orgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: { id: string }) => p.id === projectId)).toBe(true);
    });

    it('GET /projects?orgId= - viewer can list projects', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects?orgId=${orgId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /projects/:id - should get project details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(projectId);
      expect(res.body.name).toBe('Test Project');
    });

    it('PATCH /projects/:id - admin can update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Project Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Project Name');
    });

    it('PATCH /projects/:id - member can update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Member Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Member Updated Name');
    });

    it('PATCH /projects/:id - viewer cannot update', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Viewer Update Attempt' })
        .expect(403);
    });

    it('DELETE /projects/:id - member cannot delete', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('DELETE /projects/:id - viewer cannot delete', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('DELETE /projects/:id - admin can delete', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.deleted).toBe(true);
      projectId = ''; // Mark as deleted
    });
  });

  describe('Permission Boundaries', () => {
    it('GET /projects?orgId= - non-member forbidden', async () => {
      // Create a new user not in org
      const outsiderRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: `outsider-${Date.now()}@test.com`, password: testPassword })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/projects?orgId=${orgId}`)
        .set('Authorization', `Bearer ${outsiderRes.body.accessToken}`)
        .expect(403);

      // Cleanup
      await prisma.user.delete({ where: { id: outsiderRes.body.user.id } });
    });

    it('GET /orgs/:orgId/members - non-member forbidden', async () => {
      const outsiderRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: `outsider2-${Date.now()}@test.com`, password: testPassword })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${outsiderRes.body.accessToken}`)
        .expect(403);

      await prisma.user.delete({ where: { id: outsiderRes.body.user.id } });
    });
  });
});
