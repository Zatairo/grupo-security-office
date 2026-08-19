import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsObject,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPLIER_STATUSES } from './create-supplier.dto';

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Distribuidora Hikvision Colombia SAS' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '900123456-7' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @IsOptional()
  nit?: string;

  @ApiPropertyOptional({ description: 'Información de contacto libre (objeto JSON)' })
  @IsObject()
  @IsOptional()
  contact?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'VIDEO' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: SUPPLIER_STATUSES })
  @IsIn(SUPPLIER_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 80, description: 'Calificación (0 a 100, escala UI)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  rating?: number;
}