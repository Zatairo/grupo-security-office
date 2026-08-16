import { IsInt, Min, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const STOCK_ADJUSTMENT_TYPES = ['in', 'out', 'adjust'] as const;

/**
 * Nota de esquema: el modelo Stock del Incr0 NO tiene columna `minQuantity`
 * ni campos JSONB (ver schema.prisma). `quantity` se persiste en `availableQty`;
 * `minQuantity` y `reason` se registran en auditoría (entidad Stock, acciones
 * 'settings' / 'movement_*') para no requerir migraciones.
 */
export class CreateStockDto {
  @ApiProperty({ example: 42, description: 'Cantidad disponible (availableQty)' })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 'BODEGA-PEREIRA' })
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

  @ApiPropertyOptional({ example: 'Ingreso por compra' })
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