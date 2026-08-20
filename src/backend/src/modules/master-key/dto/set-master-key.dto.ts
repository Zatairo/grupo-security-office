import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetMasterKeyDto {
  @ApiProperty({ minLength: 6, description: 'Nueva clave maestra (mínimo 6 caracteres)' })
  @IsString()
  @MinLength(6)
  masterKey: string;

  @ApiPropertyOptional({
    description: 'Clave maestra actual (obligatoria si ya existe una configurada)',
  })
  @IsString()
  @IsOptional()
  currentMasterKey?: string;
}