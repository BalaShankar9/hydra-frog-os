import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { ScheduleService } from './schedule.service';
import { UpdateScheduleDto } from './dto';

interface JwtUser {
  id: string;
  email: string;
}

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Patch()
  @ApiOperation({ summary: 'Update project crawl schedule' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - viewers cannot modify schedules' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateSchedule(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.updateSchedule(
      user.id,
      projectId,
      dto.enabled,
      dto.frequency,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get project crawl schedule' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Schedule details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getSchedule(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
  ) {
    return this.scheduleService.getSchedule(user.id, projectId);
  }
}
