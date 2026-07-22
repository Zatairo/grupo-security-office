import { IsEmail, IsString, MinLength, IsBoolean, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@grupo-security.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: ['role-id-1', 'role-id-2'] })
  @IsArray()
  @IsOptional()
  roleIds?: string[];
}
