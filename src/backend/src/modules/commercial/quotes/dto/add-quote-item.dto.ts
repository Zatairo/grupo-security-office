import { IsInt, IsOptional, IsUUID, Min, IsDecimal } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddQuoteItemDto {
  @ApiProperty({ example: '4d2f8a1c-...' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, default: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: '10.00', description: 'Descuento porcentual sobre la línea (0-100)' })
  @IsDecimal()
  @IsOptional()
  discountPct?: string;
}
