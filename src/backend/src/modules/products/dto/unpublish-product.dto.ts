import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UnpublishProductDto {
  @ApiPropertyOptional({
    example: 'Campaña finalizada',
    description: 'Motivo de despublicación/archivo. Se persiste en unpublishReason.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}