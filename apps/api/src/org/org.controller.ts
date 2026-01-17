import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { OrgService } from './org.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard, CurrentUser } from '../auth';

interface AuthUser {
  id: string;
  email: string;
}

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations where current user is a member' })
  @ApiResponse({
    status: 200,
    description: 'List of organizations with membership info',
  })
  async listOrgs(@CurrentUser() user: AuthUser) {
    return this.orgService.listOrgsForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async createOrg(@CurrentUser() user: AuthUser, @Body() dto: CreateOrgDto) {
    return this.orgService.createOrg(user.id, dto);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List members of an organization' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiResponse({
    status: 200,
    description: 'List of organization members',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
  ) {
    // Verify user is a member
    await this.orgService.assertOrgMember(user.id, orgId);
    return this.orgService.listMembers(orgId);
  }

  @Post(':orgId/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to an organization (admin only)' })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only admins can add members',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization or user not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already a member',
  })
  async addMember(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
    @Body() dto: AddMemberDto,
  ) {
    // Verify user is an admin
    await this.orgService.assertOrgAdmin(user.id, orgId);
    return this.orgService.addMember(orgId, dto);
  }
}
