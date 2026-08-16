import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Estados del flujo completo de órdenes de compra (checklist 45-49). */
export const PO_STATUSES = [
  'solicitada',
  'aprobada',
  'en_transito',
  'recibida',
  'cerrada',
  'cancelada',
] as const;

export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({ enum: PO_STATUSES })
  @IsIn(PO_STATUSES)
  status: string;

  @ApiPropertyOptional({ example: 'Recepción verificada en bodega.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  comment?: string;
}