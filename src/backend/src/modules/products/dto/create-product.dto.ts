import { IsString, MinLength, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ example: { resolution: '4MP', lens: '2.8mm', nightVision: '30m' } })
  @IsObject()
  @IsOptional()
  technicalSpecs?: Record<string, any>;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
