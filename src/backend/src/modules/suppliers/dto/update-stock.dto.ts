import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStockDto {
  @ApiPropertyOptional({ example: 50, description: 'Cantidad disponible (availableQty)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 'BODEGA-CALI' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  location?: string;
}