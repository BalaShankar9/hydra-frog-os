import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrgDto {
  @ApiProperty({
    example: 'Acme Corp',
    description: 'The name of the organization',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  @MaxLength(100, { message: 'Organization name must be at most 100 characters' })
  name!: string;
}
