import { IsOptional, IsString, IsNumber, Min, Max, IsArray, ValidateNested, IsEnum, IsUUID, MinLength, MaxLength, ValidateIf, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SystemField } from '../interfaces/column-mapping';

/**
 * Decisión de sección/categoría confirmada en el wizard de importación.
 * Conecta el valor fuente de la columna categoría del archivo con el nombre
 * final de la sección decidido por el usuario.
 */
export class SectionDecisionDto {
  @ApiProperty({
    description: 'Valor tal cual viene en la columna categoría del archivo (ej: "cctv")',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sourceValue: string;

  @ApiPropertyOptional({
    description: 'Nombre final de la sección decidido por el usuario (renombrado/fusionado). Requerido si action != skip',
  })
  @ValidateIf((o: SectionDecisionDto) => o.action !== 'skip')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  targetName?: string;

  @ApiProperty({
    description: 'Acción sobre la sección',
    enum: ['create', 'reuse', 'skip'],
  })
  @IsEnum(['create', 'reuse', 'skip'])
  action: 'create' | 'reuse' | 'skip';
}

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

  @ApiPropertyOptional({
    description: 'ID de la Lista destino. Si no se envía, se asigna LISTA-GENERAL (regla de fallback).',
  })
  @IsOptional()
  @IsUUID()
  listaId?: string;
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

  @ApiPropertyOptional({
    description: 'ID de la Lista destino. Si no se envía, se conserva la del preview (o LISTA-GENERAL).',
  })
  @IsOptional()
  @IsUUID()
  listaId?: string;

  @ApiPropertyOptional({
    description: 'Decisiones de secciones/categorías confirmadas en el wizard',
    type: [SectionDecisionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDecisionDto)
  sections?: SectionDecisionDto[];

  @ApiPropertyOptional({
    description:
      'Valores fijos por campo del sistema aplicados a todas las filas cuando la columna no existe o viene vacía (ej: { brand: "Hikvision", category: "CCTV" })',
    type: Object,
    example: { brand: 'Hikvision', category: 'CCTV' },
  })
  @IsOptional()
  @IsObject()
  fixedValues?: Partial<Record<SystemField, string>>;
}
