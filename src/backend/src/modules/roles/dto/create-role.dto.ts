import { IsString, MinLength, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Gerente' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Gestión de productos y precios' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['products.read', 'products.write'] })
  @IsArray()
  @IsOptional()
  permissions?: string[];
}
