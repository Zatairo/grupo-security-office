import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePriceDto {
  @ApiPropertyOptional({ example: 1600000 })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
