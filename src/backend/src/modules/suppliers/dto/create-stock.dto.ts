import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Nota de esquema: el modelo Stock del Incr0 NO tiene columna `minQuantity`
 * (ver schema.prisma). El contrato del tech-lead lo mencionaba, pero se omite
 * para no requerir migraciones. `quantity` se persiste en `availableQty`.
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
}