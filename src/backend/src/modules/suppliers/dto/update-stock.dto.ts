import { IsInt, Min, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { STOCK_ADJUSTMENT_TYPES } from './create-stock.dto';

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

  @ApiPropertyOptional({
    enum: STOCK_ADJUSTMENT_TYPES,
    description:
      'Tipo de movimiento: in (entrada), out (salida) o adjust (ajuste a valor absoluto). ' +
      'Cuando viene, se registra un movimiento de stock en auditoría.',
  })
  @IsIn(STOCK_ADJUSTMENT_TYPES)
  @IsOptional()
  adjustmentType?: string;

  @ApiPropertyOptional({ example: 'Merma detectada en inventario' })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 5, description: 'Stock mínimo para alertas (se persiste en auditoría)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;
}