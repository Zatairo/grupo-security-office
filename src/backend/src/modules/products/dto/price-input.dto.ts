import { IsString, IsNumber, Min, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Entrada de precio inline para create/update de productos.
 * Se hace upsert por (productId, priceListId).
 */
export class PriceInputDto {
  @ApiProperty({ example: 'price-list-uuid' })
  @IsString()
  priceListId: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  @Min(0.01)
  value: number;

  @ApiPropertyOptional({ example: 'COP' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z', description: 'ISO 8601' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z', description: 'ISO 8601' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
