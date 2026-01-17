import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  Matches,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiProperty({
    example: 'Updated Project Name',
    description: 'Project name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    example: 'newdomain.com',
    description: 'Domain without protocol (e.g., example.com)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, {
    message: 'Domain must be a valid domain without protocol (e.g., example.com)',
  })
  domain?: string;

  @ApiProperty({
    example: 'https://newdomain.com/',
    description: 'Start URL with https:// protocol',
    required: false,
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'startUrl must be a valid URL with https://' },
  )
  startUrl?: string;

  @ApiProperty({
    example: { maxDepth: 5, maxPages: 2000 },
    description: 'Project settings as JSON object',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'settingsJson must be a valid JSON object' })
  settingsJson?: Record<string, unknown>;
}
