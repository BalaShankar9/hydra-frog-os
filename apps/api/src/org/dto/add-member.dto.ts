import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the user to add',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    enum: OrgRole,
    example: 'MEMBER',
    description: 'Role to assign to the user',
  })
  @IsEnum(OrgRole, { message: 'Role must be ADMIN, MEMBER, or VIEWER' })
  @IsNotEmpty()
  role!: OrgRole;
}
