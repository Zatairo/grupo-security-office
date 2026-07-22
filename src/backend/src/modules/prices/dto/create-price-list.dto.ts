import { IsString, MinLength, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceListDto {
  @ApiProperty({ example: 'Lista Mayorista' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'MAYORISTA' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 'COP' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
