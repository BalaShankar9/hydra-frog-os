import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard, CurrentUser } from '../auth';

interface AuthUser {
  id: string;
  email: string;
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'List projects in an organization' })
  @ApiQuery({
    name: 'orgId',
    required: true,
    description: 'Organization ID to list projects for',
  })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of the organization',
  })
  async listProjects(
    @CurrentUser() user: AuthUser,
    @Query('orgId') orgId: string,
  ) {
    return this.projectService.listProjects(user.id, orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project (Admin/Member only)' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Viewers cannot create projects',
  })
  async createProject(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.createProject(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of the organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async getProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.projectService.getProject(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (Admin/Member only)' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Viewers cannot update projects',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async updateProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project (Admin only)' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only admins can delete projects',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async deleteProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.projectService.deleteProject(user.id, id);
  }
}
