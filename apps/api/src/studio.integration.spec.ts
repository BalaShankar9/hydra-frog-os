/**
 * Marketing Experience Studio Integration Tests
 * 
 * Tests for:
 * - Admin can create request
 * - Non-admin forbidden
 * - Approve creates ToolSpec
 * - Feature flags scoped resolution works
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma';
import { OrgRole, FeatureFlagScope } from '@prisma/client';

describe('Marketing Experience Studio (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test identifiers (unique per run)
  const testRunId = Date.now();
  const adminEmail = `studio-admin-${testRunId}@test.com`;
  const memberEmail = `studio-member-${testRunId}@test.com`;
  const testPassword = 'password123';

  // Test state
  let adminToken: string;
  let memberToken: string;
  let adminUserId: string;
  let memberUserId: string;
  let orgId: string;
  let projectId: string;
  let requestId: string;
  let toolSpecId: string;

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

    // Setup: Create admin user
    const adminSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: adminEmail, password: testPassword })
      .expect(201);
    adminToken = adminSignup.body.access_token;
    adminUserId = adminSignup.body.user.id;

    // Setup: Create member user
    const memberSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: memberEmail, password: testPassword })
      .expect(201);
    memberToken = memberSignup.body.access_token;
    memberUserId = memberSignup.body.user.id;

    // Setup: Create org (admin is auto-added as ADMIN)
    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Studio Test Org ${testRunId}` })
      .expect(201);
    orgId = orgRes.body.id;

    // Setup: Add member as MEMBER (not admin)
    await prisma.orgMember.create({
      data: {
        orgId,
        userId: memberUserId,
        role: OrgRole.MEMBER,
      },
    });

    // Setup: Create project for flag tests
    const projectRes = await request(app.getHttpServer())
      .post(`/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Studio Test Project ${testRunId}`,
        domain: 'example.com',
        startUrl: 'https://example.com',
      })
      .expect(201);
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    try {
      // Delete feature flags
      await prisma.featureFlag.deleteMany({
        where: {
          key: { startsWith: `test.studio.${testRunId}` },
        },
      });

      // Delete tool specs
      if (toolSpecId) {
        await prisma.toolSpec.deleteMany({ where: { id: toolSpecId } });
      }

      // Delete studio requests
      if (requestId) {
        await prisma.studioRequest.deleteMany({ where: { id: requestId } });
      }

      // Delete project
      if (projectId) {
        await prisma.project.deleteMany({ where: { id: projectId } });
      }

      // Delete org (cascades members)
      if (orgId) {
        await prisma.org.deleteMany({ where: { id: orgId } });
      }

      // Delete users
      await prisma.user.deleteMany({
        where: { email: { in: [adminEmail, memberEmail] } },
      });
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    await app.close();
  });

  // ============================================
  // STUDIO REQUEST TESTS
  // ============================================

  describe('Studio Requests', () => {
    describe('POST /studio/orgs/:orgId/requests', () => {
      it('Admin can create a studio request', async () => {
        const res = await request(app.getHttpServer())
          .post(`/studio/orgs/${orgId}/requests`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'SEO Dashboard Tool',
            problem: 'Marketers need to see SEO health at a glance',
            desiredOutcome: 'A dashboard showing key SEO metrics',
            targetUsers: 'Marketing managers',
            priority: 'HIGH',
          })
          .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.title).toBe('SEO Dashboard Tool');
        expect(res.body.status).toBe('IDEA');
        expect(res.body.priority).toBe('HIGH');
        expect(res.body.orgId).toBe(orgId);

        requestId = res.body.id;
      });

      it('Non-admin is forbidden from creating requests', async () => {
        const res = await request(app.getHttpServer())
          .post(`/studio/orgs/${orgId}/requests`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            title: 'Another Tool',
            problem: 'Some problem',
            desiredOutcome: 'Some outcome',
          })
          .expect(403);

        expect(res.body.message).toContain('admin');
      });

      it('Unauthenticated user cannot create requests', async () => {
        await request(app.getHttpServer())
          .post(`/studio/orgs/${orgId}/requests`)
          .send({
            title: 'Another Tool',
            problem: 'Some problem',
            desiredOutcome: 'Some outcome',
          })
          .expect(401);
      });

      it('Invalid org returns 403 for admin', async () => {
        await request(app.getHttpServer())
          .post(`/studio/orgs/invalid-org-id/requests`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Tool',
            problem: 'Problem',
            desiredOutcome: 'Outcome',
          })
          .expect(403);
      });
    });

    describe('GET /studio/orgs/:orgId/requests', () => {
      it('Admin can list requests', async () => {
        const res = await request(app.getHttpServer())
          .get(`/studio/orgs/${orgId}/requests`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].title).toBe('SEO Dashboard Tool');
      });

      it('Non-admin forbidden from listing requests', async () => {
        await request(app.getHttpServer())
          .get(`/studio/orgs/${orgId}/requests`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403);
      });
    });

    describe('GET /studio/requests/:requestId', () => {
      it('Admin can get request details', async () => {
        const res = await request(app.getHttpServer())
          .get(`/studio/requests/${requestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.id).toBe(requestId);
        expect(res.body.title).toBe('SEO Dashboard Tool');
      });

      it('Non-admin forbidden from getting request', async () => {
        await request(app.getHttpServer())
          .get(`/studio/requests/${requestId}`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403);
      });
    });
  });

  // ============================================
  // APPROVE & TOOL SPEC TESTS
  // ============================================

  describe('Approve Request & ToolSpec Creation', () => {
    describe('POST /studio/requests/:requestId/approve', () => {
      it('Admin can approve request and it creates ToolSpec', async () => {
        const res = await request(app.getHttpServer())
          .post(`/studio/requests/${requestId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify response structure
        expect(res.body.request).toBeDefined();
        expect(res.body.toolSpec).toBeDefined();

        // Verify request was updated
        expect(res.body.request.status).toBe('APPROVED');
        expect(res.body.request.approvedSpecId).toBe(res.body.toolSpec.id);

        // Verify ToolSpec was created
        expect(res.body.toolSpec.id).toBeDefined();
        expect(res.body.toolSpec.name).toContain('SEO Dashboard Tool');
        expect(res.body.toolSpec.status).toBe('DRAFT');
        expect(res.body.toolSpec.orgId).toBe(orgId);
        expect(res.body.toolSpec.requestId).toBe(requestId);

        // Verify blueprint structure
        const blueprint = res.body.toolSpec.blueprintJson;
        expect(blueprint).toBeDefined();
        expect(blueprint.title).toBe('SEO Dashboard Tool');
        expect(blueprint.createdFromRequestId).toBe(requestId);

        toolSpecId = res.body.toolSpec.id;
      });

      it('Cannot approve already approved request', async () => {
        const res = await request(app.getHttpServer())
          .post(`/studio/requests/${requestId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(409);

        expect(res.body.message).toContain('already approved');
      });

      it('Non-admin forbidden from approving', async () => {
        // Create a new request to test
        const newRequest = await prisma.studioRequest.create({
          data: {
            orgId,
            createdById: adminUserId,
            title: 'Test Request',
            problem: 'Test',
            desiredOutcome: 'Test',
          },
        });

        await request(app.getHttpServer())
          .post(`/studio/requests/${newRequest.id}/approve`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403);

        // Cleanup
        await prisma.studioRequest.delete({ where: { id: newRequest.id } });
      });
    });

    describe('GET /studio/orgs/:orgId/specs', () => {
      it('Admin can list tool specs', async () => {
        const res = await request(app.getHttpServer())
          .get(`/studio/orgs/${orgId}/specs`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].id).toBe(toolSpecId);
      });

      it('Non-admin forbidden from listing specs', async () => {
        await request(app.getHttpServer())
          .get(`/studio/orgs/${orgId}/specs`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403);
      });
    });
  });

  // ============================================
  // FEATURE FLAGS SCOPED RESOLUTION TESTS
  // ============================================

  describe('Feature Flags Scoped Resolution', () => {
    const flagKey = `test.studio.${testRunId}.feature`;

    describe('Flag scope priority: PROJECT > ORG > GLOBAL', () => {
      it('GLOBAL flag applies when no ORG/PROJECT flag exists', async () => {
        // Create GLOBAL flag (disabled)
        await prisma.featureFlag.create({
          data: {
            key: flagKey,
            enabled: false,
            scope: FeatureFlagScope.GLOBAL,
          },
        });

        // Check flag via API
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: [flagKey],
            orgId,
            projectId,
          })
          .expect(200);

        expect(res.body[flagKey]).toBe(false);
      });

      it('ORG flag overrides GLOBAL flag', async () => {
        // Create ORG flag (enabled) - should override GLOBAL (disabled)
        await prisma.featureFlag.create({
          data: {
            key: flagKey,
            enabled: true,
            scope: FeatureFlagScope.ORG,
            orgId,
          },
        });

        // Check flag
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: [flagKey],
            orgId,
            projectId,
          })
          .expect(200);

        expect(res.body[flagKey]).toBe(true);
      });

      it('PROJECT flag overrides ORG and GLOBAL flags', async () => {
        // Create PROJECT flag (disabled) - should override ORG (enabled) and GLOBAL (disabled)
        await prisma.featureFlag.create({
          data: {
            key: flagKey,
            enabled: false,
            scope: FeatureFlagScope.PROJECT,
            orgId,
            projectId,
          },
        });

        // Check flag
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: [flagKey],
            orgId,
            projectId,
          })
          .expect(200);

        expect(res.body[flagKey]).toBe(false);
      });

      it('Without projectId, ORG flag applies', async () => {
        // Check without projectId - should get ORG flag (enabled)
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: [flagKey],
            orgId,
            // No projectId
          })
          .expect(200);

        expect(res.body[flagKey]).toBe(true);
      });

      it('Without orgId/projectId, GLOBAL flag applies', async () => {
        // Check without orgId/projectId - should get GLOBAL flag (disabled)
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: [flagKey],
            // No orgId or projectId
          })
          .expect(200);

        expect(res.body[flagKey]).toBe(false);
      });
    });

    describe('Non-existent flag defaults to false', () => {
      it('Unknown flag key returns false', async () => {
        const res = await request(app.getHttpServer())
          .post('/flags/check')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            keys: ['unknown.flag.key'],
          })
          .expect(200);

        expect(res.body['unknown.flag.key']).toBe(false);
      });
    });

    describe('Flag toggle endpoint', () => {
      const toggleFlagKey = `test.studio.${testRunId}.toggle`;

      it('Toggle creates flag if not exists (enabled)', async () => {
        const res = await request(app.getHttpServer())
          .post('/flags/toggle')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            key: toggleFlagKey,
            scope: 'GLOBAL',
          })
          .expect(200);

        expect(res.body.key).toBe(toggleFlagKey);
        expect(res.body.enabled).toBe(true);
      });

      it('Toggle flips existing flag state', async () => {
        const res = await request(app.getHttpServer())
          .post('/flags/toggle')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            key: toggleFlagKey,
            scope: 'GLOBAL',
          })
          .expect(200);

        expect(res.body.enabled).toBe(false);

        // Toggle again
        const res2 = await request(app.getHttpServer())
          .post('/flags/toggle')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            key: toggleFlagKey,
            scope: 'GLOBAL',
          })
          .expect(200);

        expect(res2.body.enabled).toBe(true);

        // Cleanup
        await prisma.featureFlag.deleteMany({
          where: { key: toggleFlagKey },
        });
      });
    });
  });

  // ============================================
  // REJECT REQUEST TESTS
  // ============================================

  describe('Reject Request', () => {
    let rejectRequestId: string;

    beforeAll(async () => {
      // Create a request to reject
      const req = await prisma.studioRequest.create({
        data: {
          orgId,
          createdById: adminUserId,
          title: 'Request to Reject',
          problem: 'Test problem',
          desiredOutcome: 'Test outcome',
        },
      });
      rejectRequestId = req.id;
    });

    afterAll(async () => {
      await prisma.studioRequest.deleteMany({
        where: { id: rejectRequestId },
      });
    });

    it('Admin can reject a request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/requests/${rejectRequestId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('REJECTED');
    });

    it('Cannot reject already rejected request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/requests/${rejectRequestId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect(res.body.message).toContain('already rejected');
    });

    it('Non-admin forbidden from rejecting', async () => {
      const newReq = await prisma.studioRequest.create({
        data: {
          orgId,
          createdById: adminUserId,
          title: 'Another Request',
          problem: 'Problem',
          desiredOutcome: 'Outcome',
        },
      });

      await request(app.getHttpServer())
        .post(`/studio/requests/${newReq.id}/reject`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      await prisma.studioRequest.delete({ where: { id: newReq.id } });
    });
  });

  // ============================================
  // AI SUGGESTIONS TESTS
  // ============================================

  describe('AI Suggestions', () => {
    let suggestRequestId: string;

    beforeAll(async () => {
      const req = await prisma.studioRequest.create({
        data: {
          orgId,
          createdById: adminUserId,
          title: 'SEO Performance Tracker',
          problem: 'Need to track page performance and core web vitals over time',
          desiredOutcome: 'Dashboard showing performance trends and regressions',
          targetUsers: 'Technical SEO specialists',
        },
      });
      suggestRequestId = req.id;
    });

    afterAll(async () => {
      await prisma.studioRequest.deleteMany({
        where: { id: suggestRequestId },
      });
    });

    it('Admin can generate AI suggestions', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/requests/${suggestRequestId}/suggestions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify suggestion structure
      expect(res.body.suggestedCategory).toBeDefined();
      expect(res.body.suggestedDataSources).toBeDefined();
      expect(Array.isArray(res.body.suggestedDataSources)).toBe(true);
      expect(res.body.suggestedInputs).toBeDefined();
      expect(res.body.suggestedScreens).toBeDefined();
      expect(res.body.suggestedKpis).toBeDefined();
      expect(res.body.suggestedRisks).toBeDefined();
      expect(res.body.complexity).toBeDefined();

      // Based on "performance" in the problem, expect PERF_AUDITS data source
      expect(res.body.suggestedDataSources).toContain('PERF_AUDITS');
    });

    it('Non-admin forbidden from generating suggestions', async () => {
      await request(app.getHttpServer())
        .post(`/studio/requests/${suggestRequestId}/suggestions`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });
});
