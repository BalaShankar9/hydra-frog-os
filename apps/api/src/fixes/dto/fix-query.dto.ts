import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FixStatus, FixType } from '@prisma/client';

export class FixesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ enum: FixStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(FixStatus)
  status?: FixStatus;

  @ApiPropertyOptional({ enum: FixType, description: 'Filter by fix type' })
  @IsOptional()
  @IsEnum(FixType)
  fixType?: FixType;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class UpdateFixStatusDto {
  @ApiPropertyOptional({ enum: FixStatus, description: 'New status' })
  @IsEnum(FixStatus)
  status!: FixStatus;
}
