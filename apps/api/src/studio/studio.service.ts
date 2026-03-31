import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  StudioRequestStatus,
  StudioRequestPriority,
  FeatureFlagScope,
  OrgRole,
} from '@prisma/client';
import {
  CreateStudioRequestDto,
  UpdateStudioRequestDto,
  StudioRequestQueryDto,
  UpdateToolSpecDto,
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagQueryDto,
} from './dto';
import { generateSuggestions, SuggestionsOutput } from './suggestions';
import { validateBlueprintJson } from './blueprints/blueprint.validator';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // AUDIT LOGGING
  // ============================================

  private audit(action: string, details: Record<string, unknown>) {
    this.logger.log({
      audit: true,
      action,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  // ============================================
  // RBAC HELPER
  // ============================================

  /**
   * Verify user is ADMIN in the org
   */
  async verifyOrgAdmin(userId: string, orgId: string): Promise<void> {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: { orgId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (membership.role !== OrgRole.ADMIN) {
      throw new ForbiddenException('Only organization admins can access Studio');
    }
  }

  /**
   * Get user's admin orgs
   */
  async getUserAdminOrgs(userId: string): Promise<string[]> {
    const memberships = await this.prisma.orgMember.findMany({
      where: {
        userId,
        role: OrgRole.ADMIN,
      },
      select: { orgId: true },
    });
    return memberships.map((m) => m.orgId);
  }

  // ============================================
  // STUDIO REQUESTS
  // ============================================

  /**
   * Create a new studio request
   */
  async createRequest(userId: string, orgId: string, dto: CreateStudioRequestDto) {
    await this.verifyOrgAdmin(userId, orgId);

    const request = await this.prisma.studioRequest.create({
      data: {
        orgId,
        createdById: userId,
        title: dto.title,
        problem: dto.problem,
        desiredOutcome: dto.desiredOutcome,
        targetUsers: dto.targetUsers,
        priority: dto.priority ?? StudioRequestPriority.MEDIUM,
        notesJson: (dto.notesJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    this.audit('REQUEST_CREATED', {
      requestId: request.id,
      orgId,
      userId,
      title: dto.title,
    });

    return request;
  }

  /**
   * List studio requests for org
   */
  async listRequests(userId: string, orgId: string, query: StudioRequestQueryDto) {
    await this.verifyOrgAdmin(userId, orgId);

    const where: Record<string, unknown> = { orgId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const requests = await this.prisma.studioRequest.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        toolSpecs: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    return requests;
  }

  /**
   * Get a single studio request
   */
  async getRequest(userId: string, requestId: string) {
    const request = await this.prisma.studioRequest.findUnique({
      where: { id: requestId },
      include: {
        toolSpecs: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    await this.verifyOrgAdmin(userId, request.orgId);

    return request;
  }

  /**
   * Update a studio request
   */
  async updateRequest(userId: string, requestId: string, dto: UpdateStudioRequestDto) {
    const request = await this.prisma.studioRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    await this.verifyOrgAdmin(userId, request.orgId);

    const updateData: Prisma.StudioRequestUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.problem !== undefined) updateData.problem = dto.problem;
    if (dto.desiredOutcome !== undefined) updateData.desiredOutcome = dto.desiredOutcome;
    if (dto.targetUsers !== undefined) updateData.targetUsers = dto.targetUsers;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notesJson !== undefined) updateData.notesJson = dto.notesJson as Prisma.InputJsonValue;
    if (dto.aiSuggestionsJson !== undefined) updateData.aiSuggestionsJson = dto.aiSuggestionsJson as Prisma.InputJsonValue;

    const updated = await this.prisma.studioRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Approve a studio request - creates a ToolSpec blueprint
   */
  async approveRequest(userId: string, requestId: string) {
    const request = await this.prisma.studioRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    await this.verifyOrgAdmin(userId, request.orgId);

    if (request.status === StudioRequestStatus.APPROVED) {
      throw new ConflictException('Request is already approved');
    }

    if (request.status === StudioRequestStatus.REJECTED) {
      throw new ConflictException('Cannot approve a rejected request');
    }

    // Create ToolSpec blueprint from request
    const blueprintJson = {
      title: request.title,
      problem: request.problem,
      desiredOutcome: request.desiredOutcome,
      targetUsers: request.targetUsers,
      inputs: [],
      outputs: [],
      steps: [],
      aiPrompts: {},
      createdFromRequestId: request.id,
      createdAt: new Date().toISOString(),
    };

    // Create ToolSpec and update request in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const toolSpec = await tx.toolSpec.create({
        data: {
          orgId: request.orgId,
          requestId: request.id,
          name: `Tool: ${request.title}`,
          description: request.problem,
          blueprintJson,
          status: 'DRAFT',
        },
      });

      const updatedRequest = await tx.studioRequest.update({
        where: { id: requestId },
        data: {
          status: StudioRequestStatus.APPROVED,
          approvedSpecId: toolSpec.id,
        },
      });

      return { request: updatedRequest, toolSpec };
    });

    this.audit('REQUEST_APPROVED', {
      requestId,
      orgId: request.orgId,
      userId,
      toolSpecId: result.toolSpec.id,
    });

    return result;
  }

  /**
   * Reject a studio request
   */
  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prisma.studioRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    await this.verifyOrgAdmin(userId, request.orgId);

    if (request.status === StudioRequestStatus.REJECTED) {
      throw new ConflictException('Request is already rejected');
    }

    if (request.status === StudioRequestStatus.SHIPPED) {
      throw new ConflictException('Cannot reject a shipped request');
    }

    const updated = await this.prisma.studioRequest.update({
      where: { id: requestId },
      data: { status: StudioRequestStatus.REJECTED },
    });

    this.audit('REQUEST_REJECTED', {
      requestId,
      orgId: request.orgId,
      userId,
    });

    return updated;
  }

  // ============================================
  // TOOL SPECS
  // ============================================

  /**
   * List tool specs for org
   */
  async listSpecs(userId: string, orgId: string) {
    await this.verifyOrgAdmin(userId, orgId);

    const specs = await this.prisma.toolSpec.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        request: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return specs;
  }

  /**
   * Get a single tool spec
   */
  async getSpec(userId: string, specId: string) {
    const spec = await this.prisma.toolSpec.findUnique({
      where: { id: specId },
      include: {
        request: true,
      },
    });

    if (!spec) {
      throw new NotFoundException(`Tool spec ${specId} not found`);
    }

    await this.verifyOrgAdmin(userId, spec.orgId);

    return spec;
  }

  /**
   * Update a tool spec
   */
  async updateSpec(userId: string, specId: string, dto: UpdateToolSpecDto) {
    const spec = await this.prisma.toolSpec.findUnique({
      where: { id: specId },
    });

    if (!spec) {
      throw new NotFoundException(`Tool spec ${specId} not found`);
    }

    await this.verifyOrgAdmin(userId, spec.orgId);

    // Check for duplicate name in same org (if name is being changed)
    if (dto.name !== undefined && dto.name !== spec.name) {
      const existingWithName = await this.prisma.toolSpec.findFirst({
        where: {
          orgId: spec.orgId,
          name: dto.name,
          id: { not: specId }, // Exclude current spec
        },
      });

      if (existingWithName) {
        throw new ConflictException(
          `A tool spec named "${dto.name}" already exists in this organization`
        );
      }
    }

    // Validate blueprint if provided
    if (dto.blueprintJson !== undefined) {
      const validation = validateBlueprintJson(dto.blueprintJson);
      if (!validation.valid) {
        const errorMessages = validation.errors
          .slice(0, 5) // Limit to first 5 errors
          .map((e: { path: string; message: string }) => `${e.path}: ${e.message}`)
          .join('; ');
        throw new BadRequestException(
          `Invalid blueprint: ${errorMessages}${validation.errors.length > 5 ? ` (and ${validation.errors.length - 5} more errors)` : ''}`
        );
      }
    }

    const updateData: Prisma.ToolSpecUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.version !== undefined) updateData.version = dto.version;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.blueprintJson !== undefined) updateData.blueprintJson = dto.blueprintJson as Prisma.InputJsonValue;
    if (dto.status !== undefined) updateData.status = dto.status;

    const updated = await this.prisma.toolSpec.update({
      where: { id: specId },
      data: updateData,
    });

    this.audit('SPEC_UPDATED', {
      specId,
      orgId: spec.orgId,
      userId,
      changedFields: Object.keys(updateData),
    });

    return updated;
  }

  // ============================================
  // FEATURE FLAGS
  // ============================================

  /**
   * List feature flags
   */
  async listFlags(userId: string, query: FeatureFlagQueryDto) {
    // For global flags, no org check needed
    // For org/project flags, user must be admin of that org
    const adminOrgIds = await this.getUserAdminOrgs(userId);

    if (adminOrgIds.length === 0) {
      throw new ForbiddenException('No admin access to any organization');
    }

    const where: Record<string, unknown> = {};

    if (query.scope) {
      where.scope = query.scope;
    }

    if (query.orgId) {
      if (!adminOrgIds.includes(query.orgId)) {
        throw new ForbiddenException('Not admin of specified organization');
      }
      where.orgId = query.orgId;
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Filter to only show flags user has access to
    const flags = await this.prisma.featureFlag.findMany({
      where: {
        ...where,
        OR: [
          { scope: FeatureFlagScope.GLOBAL },
          { orgId: { in: adminOrgIds } },
        ],
      },
      orderBy: { key: 'asc' },
    });

    return flags;
  }

  /**
   * Create a feature flag
   */
  async createFlag(userId: string, dto: CreateFeatureFlagDto) {
    // For ORG or PROJECT scope, verify admin access
    if (dto.scope === FeatureFlagScope.ORG || dto.scope === FeatureFlagScope.PROJECT) {
      if (!dto.orgId) {
        throw new ForbiddenException('orgId is required for ORG/PROJECT scope');
      }
      await this.verifyOrgAdmin(userId, dto.orgId);
    }

    // Check for existing flag with same key/scope/org/project
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key: dto.key,
        scope: dto.scope ?? FeatureFlagScope.GLOBAL,
        orgId: dto.orgId ?? null,
        projectId: dto.projectId ?? null,
      },
    });

    if (existing) {
      throw new ConflictException('Feature flag with this key already exists for this scope');
    }

    const flag = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        enabled: dto.enabled ?? false,
        scope: dto.scope ?? FeatureFlagScope.GLOBAL,
        orgId: dto.orgId ?? null,
        projectId: dto.projectId ?? null,
        metadataJson: (dto.metadataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    this.audit('FLAG_CREATED', {
      flagId: flag.id,
      key: dto.key,
      scope: dto.scope ?? FeatureFlagScope.GLOBAL,
      orgId: dto.orgId,
      userId,
    });

    return flag;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(userId: string, flagId: string, dto: UpdateFeatureFlagDto) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { id: flagId },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${flagId} not found`);
    }

    // For org-scoped flags, verify admin access
    if (flag.orgId) {
      await this.verifyOrgAdmin(userId, flag.orgId);
    } else {
      // Global flags - verify user is admin somewhere
      const adminOrgIds = await this.getUserAdminOrgs(userId);
      if (adminOrgIds.length === 0) {
        throw new ForbiddenException('Only admins can manage feature flags');
      }
    }

    const updated = await this.prisma.featureFlag.update({
      where: { id: flagId },
      data: {
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.metadataJson !== undefined && { metadataJson: dto.metadataJson as Prisma.InputJsonValue }),
      },
    });

    this.audit('FLAG_UPDATED', {
      flagId,
      key: flag.key,
      userId,
      enabled: dto.enabled,
    });

    return updated;
  }

  // ============================================
  // AI SUGGESTIONS
  // ============================================

  /**
   * Generate AI suggestions for a studio request
   * Uses rule-based analysis (not LLM) to suggest features,
   * data sources, screens, KPIs, and risks
   */
  async generateSuggestionsForRequest(
    userId: string,
    requestId: string,
  ): Promise<SuggestionsOutput> {
    const request = await this.prisma.studioRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    await this.verifyOrgAdmin(userId, request.orgId);

    // Generate suggestions using the rule-based engine
    const suggestions = generateSuggestions({
      id: request.id,
      title: request.title,
      problem: request.problem,
      desiredOutcome: request.desiredOutcome,
      targetUsers: request.targetUsers,
      priority: request.priority,
    });

    // Store suggestions in the request
    await this.prisma.studioRequest.update({
      where: { id: requestId },
      data: {
        aiSuggestionsJson: suggestions as unknown as Prisma.InputJsonValue,
      },
    });

    return suggestions;
  }

  // ============================================
  // RELEASES
  // ============================================

  /**
   * List releases
   */
  async listReleases(userId: string, orgId?: string) {
    // Verify user is admin somewhere
    const adminOrgIds = await this.getUserAdminOrgs(userId);
    if (adminOrgIds.length === 0) {
      throw new ForbiddenException('Only admins can view releases');
    }

    const where: Record<string, unknown> = {};
    if (orgId) {
      if (!adminOrgIds.includes(orgId)) {
        throw new ForbiddenException('Not admin of specified organization');
      }
      where.OR = [{ orgId: null }, { orgId }];
    }

    const releases = await this.prisma.release.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return releases;
  }
}
