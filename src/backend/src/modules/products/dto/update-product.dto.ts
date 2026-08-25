import { IsString, MinLength, IsOptional, IsObject, IsArray, ValidateNested, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({
    type: [Object],
    example: [{ name: 'ficha-tecnica.pdf', url: '/uploads/doc-1.pdf', type: 'application/pdf', size: 204800 }],
    description: 'Documentos asociados al producto (name, url, type, size).',
  })
  @IsArray()
  @IsOptional()
  documents?: any[];

  @ApiPropertyOptional({ type: [PriceInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  @IsOptional()
  prices?: PriceInputDto[];
}
