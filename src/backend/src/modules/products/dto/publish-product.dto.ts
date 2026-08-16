import { IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PublishProductDto {
  @ApiPropertyOptional({
    example: '2026-09-01T08:00:00.000Z',
    description: 'Fecha ISO programada de publicación. Si viene (futura), el producto queda en estado "listo". Si no viene, se publica de inmediato.',
  })
  @IsISO8601()
  @IsOptional()
  publishAt?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Fecha ISO opcional de auto-despublicación (lazy evaluation al leer).',
  })
  @IsISO8601()
  @IsOptional()
  unpublishAt?: string;
}