import { IsBoolean, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Body del DELETE físico de un producto (P4).
 * - `confirm`: confirmación explícita obligatoria (true). Sin ella -> 400.
 */
export class DeleteProductDto {
  @ApiPropertyOptional({
    description: "Confirmación explícita del borrado físico. Obligatoria (true).",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  confirm?: boolean;
}
