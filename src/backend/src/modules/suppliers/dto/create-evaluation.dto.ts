import { IsObject, IsNumber, Min, Max, IsOptional, IsISO8601, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEvaluationDto {
  @ApiProperty({
    example: { delivery: 4, quality: 5, price: 3, service: 4 },
    description: 'Criterios de evaluación (objeto JSONB libre)',
  })
  @IsObject()
  criteria: Record<string, unknown>;

  @ApiProperty({ example: 4.5, description: 'Puntaje global (0 a 100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional({
    example: '2026-08-10T00:00:00.000Z',
    description: 'Fecha de la evaluación (ISO 8601); default hoy',
  })
  @IsISO8601()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: 'Cumplimiento puntual en la última entrega.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  observations?: string;
}