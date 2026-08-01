import { IsOptional, IsString, IsNumber, Min, Max, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para un mapping individual de columna.
 * Debe declararse antes de PreviewImportDto porque lo referencia.
 */
export class ColumnMappingDto {
  @ApiPropertyOptional({ description: 'Header original del archivo' })
  @IsString()
  sourceColumn: string;

  @ApiPropertyOptional({ description: 'Campo del sistema al que mapea' })
  @IsString()
  targetField: string;
}

/**
 * DTO para el endpoint de preview (dry-run).
 * Permite configurar la detección y mapeo antes de ejecutar.
 */
export class PreviewImportDto {
  @ApiPropertyOptional({
    description: 'Índice de fila donde están los headers (0-based)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  headerRowIndex?: number;

  @ApiPropertyOptional({
    description: 'Mappings manuales de columnas del archivo a campos del sistema',
    type: [ColumnMappingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  columnMappings?: ColumnMappingDto[];

  @ApiPropertyOptional({
    description: 'ID de un preset de mapping guardado',
  })
  @IsOptional()
  @IsString()
  presetId?: string;
}

/**
 * DTO para el endpoint de ejecución (commit).
 */
export class ExecuteImportDto {
  @ApiProperty({
    description: 'ID de la importación (obtenido del endpoint de preview)',
  })
  @IsString()
  importId: string;

  @ApiPropertyOptional({
    description: 'Mappings de columnas confirmados por el usuario',
    type: [ColumnMappingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  columnMappings?: ColumnMappingDto[];

  @ApiPropertyOptional({
    description: 'Modo de manejo de IVA',
    enum: ['with_iva', 'without_iva', 'mixed'],
    default: 'with_iva',
  })
  @IsOptional()
  @IsEnum(['with_iva', 'without_iva', 'mixed'])
  ivaMode?: 'with_iva' | 'without_iva' | 'mixed';

  @ApiPropertyOptional({
    description: 'Índice de fila donde están los headers (0-based)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  headerRowIndex?: number;

  @ApiPropertyOptional({
    description: 'Guardar el mapping como preset para futuras importaciones',
  })
  @IsOptional()
  @IsString()
  presetName?: string;
}
