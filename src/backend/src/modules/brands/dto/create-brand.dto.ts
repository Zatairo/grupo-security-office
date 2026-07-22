import { IsString, MinLength, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ example: 'Hikvision' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'hikvision' })
  @IsString()
  @MinLength(2)
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'Líder mundial en videovigilancia' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://www.hikvision.com' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
