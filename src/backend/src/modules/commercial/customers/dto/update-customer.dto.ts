import { PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Todos los campos de creación son editables (incluye `ownerId` para
 * reasignación manual de cartera). `status` puede editarse por aquí, pero la
 * conversión LEAD→CLIENTE con marca de tiempo usa `PATCH /:id/convert`.
 */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional({ description: 'Último contacto comercial (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  lastContactAt?: string;
}
