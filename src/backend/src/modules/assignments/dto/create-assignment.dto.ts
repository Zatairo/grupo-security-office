import { IsString, IsUUID, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ASSIGNMENT_RESOURCE_TYPES = [
  'PRICE_LIST',
  'CATEGORY',
  'LISTA',
  'PRODUCT',
] as const;

/**
 * Niveles reales (checklist 29/30). 'edit' se conserva como alias legacy de
 * 'edit_products' (compatibilidad OLA 4/7A); el service lo normaliza.
 */
export const ASSIGNMENT_LEVELS = [
  'view',
  'edit_prices',
  'edit_products',
  'edit',
  'manage',
  'manage_access',
] as const;

export class CreateAssignmentDto {
  @ApiProperty({ example: '0f6a66d4-4dce-41e4-b10a-8b515dd58b5d' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'LISTA', enum: ASSIGNMENT_RESOURCE_TYPES })
  @IsString()
  @IsIn(ASSIGNMENT_RESOURCE_TYPES)
  resourceType: string;

  /**
   * ID del recurso (listaId/productId) o 'ROLE:{nombreDelRol}' para grants por rol.
   * Por eso se acepta string libre y el service valida la existencia real.
   */
  @ApiProperty({ example: '4dde6e85-dd6d-4e50-b43e-57fe847a5112' })
  @IsString()
  resourceId: string;

  @ApiPropertyOptional({ example: 'view', enum: ASSIGNMENT_LEVELS })
  @IsString()
  @IsIn(ASSIGNMENT_LEVELS)
  @IsOptional()
  level?: string;
}