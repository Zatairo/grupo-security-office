import { IsString, IsEnum, IsOptional, IsArray, IsBoolean, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SpecType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
  BOOLEAN = 'BOOLEAN',
  UNIT = 'UNIT',
}

export class SpecFieldDto {
  @ApiProperty({ example: 'resolucion', description: 'Clave única del campo' })
  @IsString()
  key: string;

  @ApiProperty({ enum: SpecType, example: SpecType.TEXT, description: 'Tipo de dato del campo' })
  @IsEnum(SpecType)
  type: SpecType;

  @ApiPropertyOptional({ example: 'MP', description: 'Unidad de medida (solo para type UNIT)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ type: [String], example: ['2MP', '4MP', '8MP'], description: 'Opciones válidas (solo para type SELECT)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: true, description: 'Si el campo es obligatorio' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Valor del campo (tipo depende de type). Para SELECT puede ser string; para NUMBER number; para BOOLEAN boolean; para TEXT/UNIT string.',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { type: 'string' } },
      { $ref: '#/components/schemas/SpecFieldDto' },
    ],
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SpecFieldDto)
  value?: SpecFieldDto | SpecFieldDto[] | string | number | boolean;
}

export class SpecsDto {
  @ApiProperty({ type: [SpecFieldDto], description: 'Array de campos de especificación tipados' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecFieldDto)
  specs: SpecFieldDto[];
}