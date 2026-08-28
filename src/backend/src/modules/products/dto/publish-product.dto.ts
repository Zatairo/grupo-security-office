import { IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PublishProductDto {
  @ApiPropertyOptional({
    example: '2026-09-01T08:00:00.000Z',
    description:
      'Fecha ISO programada de publicación. Si viene (futura), el producto permanece en DRAFT con publishAt persistido (el scheduler aplicará PUBLISH). Si no viene, se publica de inmediato. Si es null, se cancela una programación existente en un producto DRAFT.',
    nullable: true,
  })
  @IsISO8601()
  @IsOptional()
  publishAt?: string | null;

  /**
   * @deprecated Se acepta únicamente por retrocompatibilidad con clientes legacy.
   * Es ignorado por la lógica de negocio. No existe auto-despublicación.
   */
  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: '[DEPRECATED] Ignorado. No existe auto-despublicación.',
    deprecated: true,
  })
  @IsISO8601()
  @IsOptional()
  unpublishAt?: string;
}