import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 'pricelist-uuid' })
  @IsString()
  priceListId: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ example: 'COP' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
