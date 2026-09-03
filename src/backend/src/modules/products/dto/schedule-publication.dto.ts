import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

/**
 * DTO para programar/cancelar publicación individual de un producto.
 * Validación estricta: publishAt obligatorio y debe ser fecha futura.
 * La interpretación de zona se hace en America/Bogota en el servicio.
 */
export class SchedulePublicationDto {
  @ApiProperty({ description: 'Fecha/hora ISO-8601 cuando se publicará el producto. Debe ser futura.', example: '2026-12-25T10:00:00.000Z' })
  @IsISO8601()
  @IsNotEmpty()
  publishAt: string;
}
