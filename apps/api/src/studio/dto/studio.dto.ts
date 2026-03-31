import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import {
  StudioRequestStatus,
  StudioRequestPriority,
  FeatureFlagScope,
} from '@prisma/client';

// ============================================
// STUDIO REQUESTS DTOs
// ============================================

export class CreateStudioRequestDto {
  @ApiProperty({ description: 'Request title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Problem description' })
  @IsString()
  @IsNotEmpty()
  problem!: string;

  @ApiProperty({ description: 'Desired outcome' })
  @IsString()
  @IsNotEmpty()
  desiredOutcome!: string;

  @ApiPropertyOptional({ description: 'Target users' })
  @IsString()
  @IsOptional()
  targetUsers?: string;

  @ApiPropertyOptional({ enum: StudioRequestPriority, default: 'MEDIUM' })
  @IsEnum(StudioRequestPriority)
  @IsOptional()
  priority?: StudioRequestPriority;

  @ApiPropertyOptional({ description: 'Additional notes (JSON)' })
  @IsObject()
  @IsOptional()
  notesJson?: Record<string, unknown>;
}

export class UpdateStudioRequestDto extends PartialType(CreateStudioRequestDto) {
  @ApiPropertyOptional({ enum: StudioRequestStatus })
  @IsEnum(StudioRequestStatus)
  @IsOptional()
  status?: StudioRequestStatus;

  @ApiPropertyOptional({ description: 'AI suggestions (JSON)' })
  @IsObject()
  @IsOptional()
  aiSuggestionsJson?: Record<string, unknown>;
}

export class StudioRequestQueryDto {
  @ApiPropertyOptional({ enum: StudioRequestStatus })
  @IsEnum(StudioRequestStatus)
  @IsOptional()
  status?: StudioRequestStatus;

  @ApiPropertyOptional({ enum: StudioRequestPriority })
  @IsEnum(StudioRequestPriority)
  @IsOptional()
  priority?: StudioRequestPriority;
}

// ============================================
// TOOL SPECS DTOs
// ============================================

export class UpdateToolSpecDto {
  @ApiPropertyOptional({ description: 'Tool name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Tool version' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ description: 'Tool description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Blueprint JSON' })
  @IsObject()
  @IsOptional()
  blueprintJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Status (DRAFT|READY|SHIPPED)' })
  @IsString()
  @IsOptional()
  status?: string;
}

// ============================================
// FEATURE FLAGS DTOs
// ============================================

export class CreateFeatureFlagDto {
  @ApiProperty({ description: 'Feature flag key' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ description: 'Is enabled', default: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: FeatureFlagScope, default: 'GLOBAL' })
  @IsEnum(FeatureFlagScope)
  @IsOptional()
  scope?: FeatureFlagScope;

  @ApiPropertyOptional({ description: 'Organization ID (for ORG scope)' })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({ description: 'Project ID (for PROJECT scope)' })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsObject()
  @IsOptional()
  metadataJson?: Record<string, unknown>;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({ description: 'Is enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsObject()
  @IsOptional()
  metadataJson?: Record<string, unknown>;
}

export class FeatureFlagQueryDto {
  @ApiPropertyOptional({ enum: FeatureFlagScope })
  @IsEnum(FeatureFlagScope)
  @IsOptional()
  scope?: FeatureFlagScope;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsString()
  @IsOptional()
  projectId?: string;
}
