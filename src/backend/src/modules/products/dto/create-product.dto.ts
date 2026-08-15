import { IsString, MinLength, IsOptional, IsBoolean, IsObject, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceInputDto } from './price-input.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'DS-2CD2143G2-I' })
  @IsString()
  @MinLength(2)
  sku: string;

  @ApiProperty({ example: 'Cámara IP Bullet 4MP' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Cámara de alta resolución para exterior' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'category-uuid-here' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 'brand-uuid-here' })
  @IsString()
  brandId: string;

  @ApiPropertyOptional({ example: 'catalog-uuid-here', description: 'Si no se envía, se asigna el catálogo por defecto (CAT-DEFAULT)' })
  @IsString()
  @IsOptional()
  catalogId?: string;

  @ApiPropertyOptional({ example: 'lista-uuid-here', description: 'Lista comercial a la que pertenece el producto. Si no se envía, se asigna LISTA-GENERAL (regla de fallback).' })
  @IsString()
  @IsUUID()
  @IsOptional()
  listaId?: string;

  @ApiPropertyOptional({ example: { resolution: '4MP', lens: '2.8mm', nightVision: '30m' } })
  @IsObject()
  @IsOptional()
  technicalSpecs?: Record<string, any>;

  @ApiPropertyOptional({ example: { garantia: '1 año', origen: 'China', ip: '127.0.0.1' } })
  @IsObject()
  @IsOptional()
  extraAttributes?: Record<string, any>;

  @ApiPropertyOptional({
    type: [PriceInputDto],
    example: [{ priceListId: 'price-list-uuid', value: 1500000, currency: 'COP' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  @IsOptional()
  prices?: PriceInputDto[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
