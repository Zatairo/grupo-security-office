import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const PO_STATUSES = ['solicitada', 'aprobada', 'recibida', 'cancelada'] as const;

export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({ enum: PO_STATUSES })
  @IsIn(PO_STATUSES)
  status: string;
}