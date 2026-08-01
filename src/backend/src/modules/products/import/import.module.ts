import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';

import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ExcelAdapter } from './sources/excel-adapter';
import { HeaderDetectorService } from './pipeline/header-detector.service';
import { ColumnMapperService } from './pipeline/column-mapper.service';
import { RowValidatorService } from './pipeline/row-validator.service';
import { RowNormalizerService } from './pipeline/row-normalizer.service';
import { BatchExecutorService } from './pipeline/batch-executor.service';

/**
 * Sub-módulo de importación masiva de productos.
 *
 * Aísla toda la lógica de importación (pipeline, adapters, controllers)
 * del módulo principal de productos.
 *
 * Dependencias:
 * - PrismaModule: acceso a la base de datos
 * - AuditModule: registro de auditoría de importaciones
 */
@Module({
  imports: [
    PrismaModule,
    AuditModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    ExcelAdapter,
    HeaderDetectorService,
    ColumnMapperService,
    RowValidatorService,
    RowNormalizerService,
    BatchExecutorService,
  ],
  exports: [ImportService],
})
export class ImportModule {}
