import { IsString, MinLength, IsOptional, IsBoolean, IsObject, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PriceInputDto } from './price-input.dto';

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
  @IsString()
  @IsOptional()
  catalogId?: string;

  @ApiPropertyOptional({ example: 'lista-uuid-here', description: 'Lista comercial a la que se reasigna el producto.' })
  @IsString()
  @IsUUID()
  @IsOptional()
  listaId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  technicalSpecs?: Record<string, any>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  extraAttributes?: Record<string, any>;

  @ApiPropertyOptional({ type: [PriceInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  @IsOptional()
  prices?: PriceInputDto[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
