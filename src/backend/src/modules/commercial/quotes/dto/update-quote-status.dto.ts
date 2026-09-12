import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const QUOTE_STATUSES = [
  'borrador',
  'enviada',
  'negociacion',
  'ganada',
  'perdida',
  'cancelada',
] as const;

export class UpdateQuoteStatusDto {
  @ApiProperty({ enum: QUOTE_STATUSES, example: 'enviada' })
  @IsIn(QUOTE_STATUSES)
  status: string;

  @ApiPropertyOptional({ example: 'Precio fuera de presupuesto' })
  @IsString()
  @IsOptional()
  lostReason?: string;
}
