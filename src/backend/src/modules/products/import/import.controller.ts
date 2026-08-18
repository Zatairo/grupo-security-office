import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ImportService } from './import.service';
import { PreviewImportDto, ExecuteImportDto } from './dto/preview-import.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('Products - Importación')
@ApiBearerAuth()
@Controller('api/products/import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * FASE 1: Preview — Analiza el archivo sin modificar la BD.
   * Retorna: headers detectados, mapeos sugeridos, validación de filas.
   */
  @Post('preview')
  @Roles('Super Admin', 'Admin Comercial')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Vista previa de importación (dry-run)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        headerRowIndex: { type: 'number', default: 0 },
        columnMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceColumn: { type: 'string' },
              targetField: { type: 'string' },
            },
          },
        },
        presetId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Preview generado exitosamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido o mapping incompleto' })
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    const dto: PreviewImportDto = {
      headerRowIndex: body.headerRowIndex ? parseInt(body.headerRowIndex) : undefined,
      columnMappings: body.columnMappings
        ? JSON.parse(body.columnMappings)
        : undefined,
      presetId: body.presetId,
      listaId: body.listaId,
    };

    return this.importService.preview(
      file.buffer,
      file.originalname,
      req.user.id,
      dto,
    );
  }

  /**
   * FASE 2: Execute — Ejecuta la importación real.
   * Requiere que se haya ejecutado preview previamente.
   */
  @Post('execute')
  @Roles('Super Admin', 'Admin Comercial')
  @HttpCode(201)
  @ApiOperation({ summary: 'Ejecutar importación (commit)' })
  @ApiResponse({ status: 201, description: 'Importación ejecutada exitosamente' })
  @ApiResponse({ status: 400, description: 'Importación no encontrada o error de ejecución' })
  async execute(
    @Body() dto: ExecuteImportDto,
    @Req() req: any,
  ) {
    return this.importService.execute(
      dto.importId,
      {
        columnMappings: dto.columnMappings,
        ivaMode: dto.ivaMode,
        headerRowIndex: dto.headerRowIndex,
        presetName: dto.presetName,
        listaId: dto.listaId,
        sections: dto.sections,
      },
      req.user.id,
    );
  }

  /**
   * Progreso de una importación activa.
   */
  @Get('progress/:importId')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Consultar progreso de importación' })
  @ApiResponse({ status: 200, description: 'Progreso de la importación' })
  async getProgress(@Param('importId') importId: string) {
    return this.importService.getProgress(importId);
  }

  // === Presets de Mapping ===

  @Get('mappings')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Listar presets de mapping del usuario' })
  async listPresets(@Req() req: any) {
    return this.importService.listPresets(req.user.id);
  }

  @Post('mappings')
  @Roles('Super Admin', 'Admin Comercial')
  @HttpCode(201)
  @ApiOperation({ summary: 'Guardar preset de mapping' })
  async savePreset(
    @Body() body: { name: string; mapping: any; isDefault?: boolean },
    @Req() req: any,
  ) {
    return this.importService.savePreset(
      body.mapping,
      body.name,
      req.user.id,
      body.isDefault,
    );
  }

  @Delete('mappings/:id')
  @Roles('Super Admin', 'Admin Comercial')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar preset de mapping' })
  async deletePreset(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.importService.deletePreset(id, req.user.id);
  }
}
