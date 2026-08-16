import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductImageDto {
  @ApiPropertyOptional({ example: 'Cámara IP 4MP vista frontal' })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ example: true, description: 'Marca esta imagen como principal (desmarca las demás del mismo producto).' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
