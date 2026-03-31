/**
 * Feature Flag Controller
 * 
 * Endpoints for checking and managing feature flags
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FlagService, FLAG_KEYS } from './flag.service';
import {
  CheckFlagsDto,
  GetFlagsDto,
  CreateFlagDto,
  UpdateFlagDto,
  ToggleFlagDto,
  DeleteFlagDto,
} from './dto';
import { FeatureFlagScope } from '@prisma/client';

@Controller('flags')
@UseGuards(JwtAuthGuard)
export class FlagController {
  private readonly logger = new Logger(FlagController.name);

  constructor(private readonly flagService: FlagService) {}

  // ============================================
  // READ ENDPOINTS
  // ============================================

  /**
   * GET /flags
   * Get all enabled flags for current context
   */
  @Get()
  async getFlags(@Query() query: GetFlagsDto) {
    return this.flagService.getEnabledFlags({
      orgId: query.orgId,
      projectId: query.projectId,
    });
  }

  /**
   * GET /flags/all
   * Get all flags (admin endpoint)
   */
  @Get('all')
  async getAllFlags() {
    return this.flagService.getAllFlags();
  }

  /**
   * GET /flags/keys
   * Get all well-known flag keys
   */
  @Get('keys')
  async getFlagKeys() {
    return {
      keys: FLAG_KEYS,
    };
  }

  /**
   * POST /flags/check
   * Check multiple flags at once
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkFlags(@Body() body: CheckFlagsDto) {
    return this.flagService.checkFlags(body.keys, {
      orgId: body.orgId,
      projectId: body.projectId,
    });
  }

  /**
   * GET /flags/check/:key
   * Check a single flag
   */
  @Get('check/:key')
  async checkFlag(
    @Query('key') key: string,
    @Query('orgId') orgId?: string,
    @Query('projectId') projectId?: string
  ) {
    const enabled = await this.flagService.isEnabled(key, { orgId, projectId });
    return { key, enabled };
  }

  // ============================================
  // WRITE ENDPOINTS (Admin)
  // ============================================

  /**
   * POST /flags
   * Create a new feature flag
   */
  @Post()
  async createFlag(@Body() body: CreateFlagDto) {
    this.logger.log(`Creating flag: ${body.key}`);
    return this.flagService.createFlag(body);
  }

  /**
   * PUT /flags
   * Update an existing flag
   */
  @Put()
  async updateFlag(
    @Query('key') key: string,
    @Query('scope') scope: FeatureFlagScope,
    @Query('orgId') orgId: string | undefined,
    @Query('projectId') projectId: string | undefined,
    @Body() body: UpdateFlagDto
  ) {
    this.logger.log(`Updating flag: ${key} (${scope})`);
    return this.flagService.updateFlag(
      key,
      scope,
      orgId ?? null,
      projectId ?? null,
      body
    );
  }

  /**
   * POST /flags/toggle
   * Toggle a flag's enabled status
   */
  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  async toggleFlag(@Body() body: ToggleFlagDto) {
    this.logger.log(`Toggling flag: ${body.key}`);
    return this.flagService.toggleFlag(
      body.key,
      body.scope ?? FeatureFlagScope.GLOBAL,
      body.orgId ?? null,
      body.projectId ?? null
    );
  }

  /**
   * DELETE /flags
   * Delete a feature flag
   */
  @Delete()
  async deleteFlag(@Body() body: DeleteFlagDto) {
    this.logger.log(`Deleting flag: ${body.key}`);
    await this.flagService.deleteFlag(
      body.key,
      body.scope,
      body.orgId ?? null,
      body.projectId ?? null
    );
    return { success: true };
  }

  // ============================================
  // CONVENIENCE ENDPOINTS
  // ============================================

  /**
   * POST /flags/enable-global
   * Enable a flag globally
   */
  @Post('enable-global')
  @HttpCode(HttpStatus.OK)
  async enableGlobal(@Body('key') key: string) {
    this.logger.log(`Enabling flag globally: ${key}`);
    return this.flagService.enableGlobal(key);
  }

  /**
   * POST /flags/disable-global
   * Disable a flag globally
   */
  @Post('disable-global')
  @HttpCode(HttpStatus.OK)
  async disableGlobal(@Body('key') key: string) {
    this.logger.log(`Disabling flag globally: ${key}`);
    return this.flagService.disableGlobal(key);
  }

  /**
   * POST /flags/enable-org
   * Enable a flag for a specific org
   */
  @Post('enable-org')
  @HttpCode(HttpStatus.OK)
  async enableForOrg(@Body('key') key: string, @Body('orgId') orgId: string) {
    this.logger.log(`Enabling flag for org: ${key} -> ${orgId}`);
    return this.flagService.enableForOrg(key, orgId);
  }

  /**
   * POST /flags/enable-project
   * Enable a flag for a specific project
   */
  @Post('enable-project')
  @HttpCode(HttpStatus.OK)
  async enableForProject(
    @Body('key') key: string,
    @Body('orgId') orgId: string,
    @Body('projectId') projectId: string
  ) {
    this.logger.log(`Enabling flag for project: ${key} -> ${projectId}`);
    return this.flagService.enableForProject(key, orgId, projectId);
  }

  /**
   * POST /flags/cache/clear
   * Clear the flag cache
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  async clearCache() {
    this.flagService.clearCache();
    return { success: true };
  }
}
