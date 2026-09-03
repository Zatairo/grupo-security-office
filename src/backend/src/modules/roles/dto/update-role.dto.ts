import { IsString, MinLength, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Supervisor' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Rol actualizado' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['products.read', 'products.write', 'listas:create'] })
  @IsArray()
  @IsOptional()
  permissions?: string[];
}
