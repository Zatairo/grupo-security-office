import { IsString, IsUUID, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ASSIGNMENT_RESOURCE_TYPES = ['PRICE_LIST', 'CATEGORY', 'LISTA'] as const;
export const ASSIGNMENT_LEVELS = ['view', 'edit', 'manage'] as const;

export class CreateAssignmentDto {
  @ApiProperty({ example: '0f6a66d4-4dce-41e4-b10a-8b515dd58b5d' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'LISTA', enum: ASSIGNMENT_RESOURCE_TYPES })
  @IsString()
  @IsIn(ASSIGNMENT_RESOURCE_TYPES)
  resourceType: string;

  @ApiProperty({ example: '4dde6e85-dd6d-4e50-b43e-57fe847a5112' })
  @IsString()
  @IsUUID()
  resourceId: string;

  @ApiPropertyOptional({ example: 'view', enum: ASSIGNMENT_LEVELS })
  @IsString()
  @IsIn(ASSIGNMENT_LEVELS)
  @IsOptional()
  level?: string;
}
