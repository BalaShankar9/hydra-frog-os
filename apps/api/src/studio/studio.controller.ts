import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudioService } from './studio.service';
import {
  CreateStudioRequestDto,
  UpdateStudioRequestDto,
  StudioRequestQueryDto,
  UpdateToolSpecDto,
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagQueryDto,
} from './dto';

@ApiTags('studio')
@ApiBearerAuth()
@Controller('studio')
@UseGuards(JwtAuthGuard)
export class StudioController {
  constructor(private readonly studioService: StudioService) {}

  // ============================================
  // STUDIO REQUESTS
  // ============================================

  /**
   * POST /studio/orgs/:orgId/requests
   * Create a new studio request
   */
  @Post('orgs/:orgId/requests')
  @ApiOperation({ summary: 'Create a new studio request' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  async createRequest(
    @CurrentUser('id') userId: string,
    @Param('orgId') orgId: string,
    @Body() dto: CreateStudioRequestDto,
  ) {
    return this.studioService.createRequest(userId, orgId, dto);
  }

  /**
   * GET /studio/orgs/:orgId/requests
   * List studio requests for an org
   */
  @Get('orgs/:orgId/requests')
  @ApiOperation({ summary: 'List studio requests for an org' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['IDEA', 'REVIEW', 'APPROVED', 'BUILDING', 'QA', 'SHIPPED', 'REJECTED'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @ApiResponse({ status: 200, description: 'List of requests' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  async listRequests(
    @CurrentUser('id') userId: string,
    @Param('orgId') orgId: string,
    @Query() query: StudioRequestQueryDto,
  ) {
    return this.studioService.listRequests(userId, orgId, query);
  }

  /**
   * GET /studio/requests/:requestId
   * Get a single studio request
   */
  @Get('requests/:requestId')
  @ApiOperation({ summary: 'Get a single studio request' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Request details' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.studioService.getRequest(userId, requestId);
  }

  /**
   * PATCH /studio/requests/:requestId
   * Update a studio request
   */
  @Patch('requests/:requestId')
  @ApiOperation({ summary: 'Update a studio request' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Request updated' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async updateRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateStudioRequestDto,
  ) {
    return this.studioService.updateRequest(userId, requestId, dto);
  }

  /**
   * POST /studio/requests/:requestId/approve
   * Approve a request and create a ToolSpec blueprint
   */
  @Post('requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve a request and create ToolSpec blueprint' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Request approved, ToolSpec created' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request already approved/rejected' })
  async approveRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.studioService.approveRequest(userId, requestId);
  }

  /**
   * POST /studio/requests/:requestId/reject
   * Reject a studio request
   */
  @Post('requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject a studio request' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request already rejected/shipped' })
  async rejectRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.studioService.rejectRequest(userId, requestId);
  }

  /**
   * POST /studio/requests/:requestId/suggest
   * Generate AI suggestions for a studio request
   */
  @Post('requests/:requestId/suggest')
  @ApiOperation({ summary: 'Generate AI suggestions for a studio request' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Suggestions generated and stored in aiSuggestionsJson' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async generateSuggestions(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.studioService.generateSuggestionsForRequest(userId, requestId);
  }

  // ============================================
  // TOOL SPECS
  // ============================================

  /**
   * GET /studio/orgs/:orgId/specs
   * List tool specs for an org
   */
  @Get('orgs/:orgId/specs')
  @ApiOperation({ summary: 'List tool specs for an org' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'List of tool specs' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  async listSpecs(
    @CurrentUser('id') userId: string,
    @Param('orgId') orgId: string,
  ) {
    return this.studioService.listSpecs(userId, orgId);
  }

  /**
   * GET /studio/specs/:specId
   * Get a single tool spec
   */
  @Get('specs/:specId')
  @ApiOperation({ summary: 'Get a single tool spec' })
  @ApiParam({ name: 'specId', description: 'Tool Spec ID' })
  @ApiResponse({ status: 200, description: 'Tool spec details' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Tool spec not found' })
  async getSpec(
    @CurrentUser('id') userId: string,
    @Param('specId') specId: string,
  ) {
    return this.studioService.getSpec(userId, specId);
  }

  /**
   * PATCH /studio/specs/:specId
   * Update a tool spec
   */
  @Patch('specs/:specId')
  @ApiOperation({ summary: 'Update a tool spec' })
  @ApiParam({ name: 'specId', description: 'Tool Spec ID' })
  @ApiResponse({ status: 200, description: 'Tool spec updated' })
  @ApiResponse({ status: 403, description: 'Not an org admin' })
  @ApiResponse({ status: 404, description: 'Tool spec not found' })
  async updateSpec(
    @CurrentUser('id') userId: string,
    @Param('specId') specId: string,
    @Body() dto: UpdateToolSpecDto,
  ) {
    return this.studioService.updateSpec(userId, specId, dto);
  }

  // ============================================
  // FEATURE FLAGS
  // ============================================

  /**
   * GET /studio/flags
   * List feature flags
   */
  @Get('flags')
  @ApiOperation({ summary: 'List feature flags' })
  @ApiQuery({ name: 'scope', required: false, enum: ['GLOBAL', 'ORG', 'PROJECT'] })
  @ApiQuery({ name: 'orgId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiResponse({ status: 200, description: 'List of feature flags' })
  @ApiResponse({ status: 403, description: 'No admin access' })
  async listFlags(
    @CurrentUser('id') userId: string,
    @Query() query: FeatureFlagQueryDto,
  ) {
    return this.studioService.listFlags(userId, query);
  }

  /**
   * POST /studio/flags
   * Create a feature flag
   */
  @Post('flags')
  @ApiOperation({ summary: 'Create a feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 409, description: 'Flag already exists' })
  async createFlag(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFeatureFlagDto,
  ) {
    return this.studioService.createFlag(userId, dto);
  }

  /**
   * PATCH /studio/flags/:flagId
   * Update a feature flag
   */
  @Patch('flags/:flagId')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiParam({ name: 'flagId', description: 'Feature Flag ID' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async updateFlag(
    @CurrentUser('id') userId: string,
    @Param('flagId') flagId: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.studioService.updateFlag(userId, flagId, dto);
  }

  // ============================================
  // RELEASES
  // ============================================

  /**
   * GET /studio/releases
   * List releases
   */
  @Get('releases')
  @ApiOperation({ summary: 'List releases' })
  @ApiQuery({ name: 'orgId', required: false, description: 'Filter by org (shows global + org releases)' })
  @ApiResponse({ status: 200, description: 'List of releases' })
  @ApiResponse({ status: 403, description: 'No admin access' })
  async listReleases(
    @CurrentUser('id') userId: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.studioService.listReleases(userId, orgId);
  }
}
