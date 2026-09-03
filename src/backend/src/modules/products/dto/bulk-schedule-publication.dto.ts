import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsISO8601, IsNotEmpty, IsString, IsOptional, MinLength, ValidateIf } from 'class-validator';

/**
 * DTO para programación masiva de publicación de productos.
 * Solo procesa los productIds explícitamente enviados.
 * Sin filtros, búsquedas ni selección por lista completa.
 */
export class BulkSchedulePublicationDto {
  @ApiProperty({ description: 'Arreglo de UUIDs de productos a programar. Mínimo 1, máximo 500. Sin duplicados.', example: ['550e8400-e29b-41d4-a716-446655440000'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  ids: string[];

  @ApiProperty({ description: 'Fecha/hora ISO-8601 cuando se publicará todos los productos. Debe ser futura.', example: '2026-12-25T10:00:00.000Z' })
  @IsISO8601()
  @IsNotEmpty()
  publishAt: string;
}
