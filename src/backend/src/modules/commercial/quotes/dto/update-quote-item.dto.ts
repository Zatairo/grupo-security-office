import { IsInt, IsOptional, Min, IsDecimal } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQuoteItemDto {
  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: '5.00', description: 'Descuento porcentual sobre la línea (0-100)' })
  @IsDecimal()
  @IsOptional()
  discountPct?: string;
}
