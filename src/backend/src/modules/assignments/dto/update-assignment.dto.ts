import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ASSIGNMENT_LEVELS } from './create-assignment.dto';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ example: 'edit', enum: ASSIGNMENT_LEVELS })
  @IsString()
  @IsIn(ASSIGNMENT_LEVELS)
  @IsOptional()
  level?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
