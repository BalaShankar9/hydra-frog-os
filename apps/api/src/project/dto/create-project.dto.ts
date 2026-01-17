import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  Matches,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    example: 'org-id-123',
    description: 'The organization ID this project belongs to',
  })
  @IsString()
  @IsNotEmpty()
  orgId!: string;

  @ApiProperty({
    example: 'Main Website Crawl',
    description: 'Project name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'example.com',
    description: 'Domain without protocol (e.g., example.com)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, {
    message: 'Domain must be a valid domain without protocol (e.g., example.com)',
  })
  domain!: string;

  @ApiProperty({
    example: 'https://example.com/',
    description: 'Start URL with https:// protocol',
  })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'startUrl must be a valid URL with https://' },
  )
  @IsNotEmpty()
  startUrl!: string;

  @ApiProperty({
    example: { maxDepth: 3, maxPages: 1000, respectRobots: true },
    description: 'Project settings as JSON object',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'settingsJson must be a valid JSON object' })
  settingsJson?: Record<string, unknown>;
}
