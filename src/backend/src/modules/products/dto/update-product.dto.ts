import { IsString, MinLength, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'DS-2CD2143G2-I-v2' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 'Cámara IP Bullet 4MP Pro' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  technicalSpecs?: Record<string, any>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
