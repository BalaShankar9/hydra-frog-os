import { IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScheduleFrequency } from '@prisma/client';

export class UpdateScheduleDto {
  @ApiProperty({
    description: 'Enable or disable the schedule',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  enabled!: boolean;

  @ApiProperty({
    description: 'Schedule frequency',
    enum: ScheduleFrequency,
    example: 'DAILY',
  })
  @IsEnum(ScheduleFrequency)
  @IsNotEmpty()
  frequency!: ScheduleFrequency;
}
