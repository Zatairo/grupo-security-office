import { IsString, IsOptional, IsIn, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CUSTOMER_STATUSES = ['LEAD', 'CLIENTE', 'INACTIVO'] as const;
export const CUSTOMER_SOURCES = [
  'REFERIDO',
  'PROMOCION',
  'LLAMADA_FRIA',
  'WEB',
  'EVENTO',
  'OTRO',
] as const;

export class CreateCustomerDto {
  @ApiProperty({ example: 'Seguridad Andina S.A.S.' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'NIT' })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiPropertyOptional({ example: '901123456-7' })
  @IsString()
  @IsOptional()
  documentId?: string;

  @ApiPropertyOptional({ example: 'contacto@empresa.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+57 300 123 4567' })
  @IsString()
  @IsOptional()
  phone?: string;

  /** Texto libre, decisión de producto: no se modelan ciudades como entidad. */
  @ApiPropertyOptional({ example: 'Bogotá' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Cra 7 # 123-45' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'LEAD', enum: CUSTOMER_STATUSES })
  @IsIn(CUSTOMER_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'REFERIDO', enum: CUSTOMER_SOURCES })
  @IsIn(CUSTOMER_SOURCES)
  @IsOptional()
  source?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceDetail?: string;

  /**
   * Dueño comercial del cliente. Si no se envía, el servicio asigna
   * `ownerId = ctx.userId` (el creador es el dueño por defecto).
   */
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
