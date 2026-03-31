/**
 * Feature Flag DTOs
 */

import { IsString, IsBoolean, IsOptional, IsEnum, IsObject } from 'class-validator';
import { FeatureFlagScope } from '@prisma/client';

export class CheckFlagsDto {
  @IsString({ each: true })
  keys!: string[];

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class GetFlagsDto {
  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class CreateFlagDto {
  @IsString()
  key!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEnum(FeatureFlagScope)
  @IsOptional()
  scope?: FeatureFlagScope;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsObject()
  @IsOptional()
  metadataJson?: Record<string, unknown>;
}

export class UpdateFlagDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  metadataJson?: Record<string, unknown>;
}

export class ToggleFlagDto {
  @IsString()
  key!: string;

  @IsEnum(FeatureFlagScope)
  @IsOptional()
  scope?: FeatureFlagScope;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class DeleteFlagDto {
  @IsString()
  key!: string;

  @IsEnum(FeatureFlagScope)
  scope!: FeatureFlagScope;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}
