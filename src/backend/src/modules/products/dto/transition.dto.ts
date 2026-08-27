import { IsBoolean, IsISO8601, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LifecycleEvent, LIFECYCLE_EVENTS } from '../lifecycle.types';

export class TransitionProductDto {
  @ApiProperty({
    enum: LIFECYCLE_EVENTS,
    description: 'Evento de la FSM de ciclo de vida del producto.',
    example: 'PUBLISH',
  })
  @IsIn(LIFECYCLE_EVENTS)
  event: LifecycleEvent;

  @ApiPropertyOptional({
    description: 'Motivo. Obligatorio para ARCHIVE y RESTORE.',
    example: 'Campaña finalizada',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Fecha ISO programada de publicación (solo para persistir publishAt en DRAFT; el scheduler aplica PUBLISH al vencer).',
    example: '2026-09-01T08:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  publishAt?: string;

  /**
   * @deprecated Se acepta únicamente por retrocompatibilidad con clientes legacy.
   * Es ignorado por la lógica de negocio. No existe auto-despublicación.
   */
  @ApiPropertyOptional({
    description: '[DEPRECATED] Ignorado. No existe auto-despublicación.',
    example: '2026-12-31T23:59:59.000Z',
    deprecated: true,
  })
  @IsISO8601()
  @IsOptional()
  unpublishAt?: string;

  @ApiPropertyOptional({
    description: 'Confirmación explícita. Obligatoria (true) para ARCHIVE y RESTORE.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  confirm?: boolean;
}