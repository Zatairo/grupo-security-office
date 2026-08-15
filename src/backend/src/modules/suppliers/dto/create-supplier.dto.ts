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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPLIER_STATUSES = ['active', 'inactive'] as const;

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora Hikvision Colombia SAS' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '900123456-7' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  nit: string;

  @ApiPropertyOptional({
    example: { phone: '+57 300 123 4567', email: 'ventas@distribuidora.com', contactName: 'Ana' },
    description: 'Información de contacto libre (objeto JSON)',
  })
  @IsObject()
  @IsOptional()
  contact?: Record<string, unknown>;

  @ApiProperty({ example: 'VIDEO' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category: string;

  @ApiPropertyOptional({ enum: SUPPLIER_STATUSES, default: 'active' })
  @IsIn(SUPPLIER_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 4.5, description: 'Calificación (0 a 9.99, columna DECIMAL(3,2))' })
  @IsNumber()
  @Min(0)
  @Max(9.99)
  @IsOptional()
  rating?: number;
}