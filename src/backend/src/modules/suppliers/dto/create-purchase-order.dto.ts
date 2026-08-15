import { IsUUID, IsObject, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PO_STATUSES } from './update-purchase-order-status.dto';

/**
 * Nota de esquema: el modelo PurchaseOrder del Incr0 NO tiene columnas
 * productId/quantity/unitCost/currency/expectedDate (ver schema.prisma):
 * la especificación del pedido se persiste en `items` (JSONB). El contrato del
 * tech-lead mencionaba esos campos, pero se mapean a `items` para no requerir
 * migraciones. `status` usa los valores del contrato (solicitada/aprobada/...).
 */
export class CreatePurchaseOrderDto {
  @ApiProperty({ example: '9f2c1a5e-...' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({
    example: { productId: '...', quantity: 10, unitCost: 150000, currency: 'COP', expectedDate: '2026-09-01' },
    description: 'Especificación del pedido (objeto JSONB)',
  })
  @IsObject()
  @IsOptional()
  items?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Reposición de cámaras de seguridad.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: PO_STATUSES, default: 'solicitada' })
  @IsIn(PO_STATUSES)
  @IsOptional()
  status?: string;
}