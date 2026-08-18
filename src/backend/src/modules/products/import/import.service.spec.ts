import { createPrismaMock } from '../../../__test__/mocks/prisma.mock';
import { ImportService } from './import.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ExcelAdapter } from './sources/excel-adapter';
import { HeaderDetectorService } from './pipeline/header-detector.service';
import { ColumnMapperService } from './pipeline/column-mapper.service';
import { RowValidatorService } from './pipeline/row-validator.service';
import { RowNormalizerService } from './pipeline/row-normalizer.service';
import { BatchExecutorService } from './pipeline/batch-executor.service';

const mockPrisma = createPrismaMock();

describe('ImportService — Lista destino (listaId)', () => {
  let service: ImportService;
  let batchExecutor: { execute: jest.Mock };

  const detection = {
    headers: ['REFERENCIA', 'DESCRIPCION'],
    headerRowIndex: 0,
    suggestedMappings: [
      { sourceColumn: 'REFERENCIA', targetField: 'sku', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'DESCRIPCION', targetField: 'name', isRequired: true, confidence: 1.0 },
    ],
    unmappedHeaders: [],
    overallConfidence: 1.0,
  };

  const mapping = {
    entries: [
      { sourceColumn: 'REFERENCIA', targetField: 'sku', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'DESCRIPCION', targetField: 'name', isRequired: true, confidence: 1.0 },
    ],
    confirmed: false,
  };

  const executeResult = {
    total: 1,
    created: 1,
    updated: 0,
    skipped: 0,
    errors: [],
    productIds: ['prod-1'],
    durationMs: 10,
    defaultsByMissingInference: { category: 0, brand: 0 },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const excelAdapter = {
      parse: jest.fn().mockReturnValue({
        headers: ['REFERENCIA', 'DESCRIPCION'],
        rows: [{ REFERENCIA: 'SKU-1', DESCRIPCION: 'Prod 1' }],
        fileSize: 1024,
        totalRows: 1,
      }),
    };

    const headerDetector = {
      detect: jest.fn().mockReturnValue(detection),
    };

    const columnMapper = {
      createFromDetection: jest.fn().mockReturnValue(mapping),
      confirmMapping: jest.fn().mockImplementation((current) => ({ ...current, confirmed: true })),
      validateMapping: jest.fn().mockReturnValue([]),
    };

    const rowValidator = {
      validateAll: jest.fn().mockImplementation((ctx: any) => ctx.validatedRows),
    };

    const rowNormalizer = {
      normalizeAll: jest.fn().mockImplementation((ctx: any) => ctx.normalizedRows),
    };

    batchExecutor = {
      execute: jest.fn().mockResolvedValue(executeResult),
    };

    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma.product.findMany.mockResolvedValue([]);

    service = new ImportService(
      mockPrisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      excelAdapter as unknown as ExcelAdapter,
      headerDetector as unknown as HeaderDetectorService,
      columnMapper as unknown as ColumnMapperService,
      rowValidator as unknown as RowValidatorService,
      rowNormalizer as unknown as RowNormalizerService,
      batchExecutor as unknown as BatchExecutorService,
    );
  });

  const runPreview = (listaId?: string) =>
    service.preview(Buffer.from('file'), 'test.xlsx', 'user-1', { listaId });

  describe('preview', () => {
    it('guarda listaId en el contexto cuando viene en el preview', async () => {
      const preview = await runPreview('lista-x');

      await service.execute(preview.importId, { columnMappings: [] }, 'user-1');

      const ctx = batchExecutor.execute.mock.calls[0][1];
      expect(ctx.listaId).toBe('lista-x');
    });

    it('deja el contexto sin listaId cuando no se envía', async () => {
      const preview = await runPreview();

      await service.execute(preview.importId, { columnMappings: [] }, 'user-1');

      const ctx = batchExecutor.execute.mock.calls[0][1];
      expect(ctx.listaId).toBeUndefined();
    });

    it('incluye distinctValuesByColumn por columna con {value,count} top-50', async () => {
      const preview = await runPreview();

      expect(preview.distinctValuesByColumn).toBeDefined();
      expect(preview.distinctValuesByColumn).toEqual({
        REFERENCIA: [{ value: 'SKU-1', count: 1 }],
        DESCRIPCION: [{ value: 'Prod 1', count: 1 }],
      });
      // No rompe el contrato existente
      expect(preview.importId).toBeDefined();
      expect(preview.detectedHeaders).toEqual(['REFERENCIA', 'DESCRIPCION']);
      expect(preview.totalRows).toBe(1);
    });

    it('agrega conteos y descarta celdas vacías en distinctValuesByColumn', async () => {
      const excelAdapterRich = {
        parse: jest.fn().mockReturnValue({
          headers: ['CATEGORIA'],
          rows: [
            { CATEGORIA: 'Video' },
            { CATEGORIA: 'Video' },
            { CATEGORIA: 'Control de Acceso' },
            { CATEGORIA: null },
            { CATEGORIA: '  Video  ' },
          ],
          fileSize: 1024,
          totalRows: 5,
        }),
      };

      const richService = new ImportService(
        mockPrisma as unknown as PrismaService,
        { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
        excelAdapterRich as unknown as ExcelAdapter,
        { detect: jest.fn().mockReturnValue(detection) } as unknown as HeaderDetectorService,
        { createFromDetection: jest.fn().mockReturnValue(mapping), confirmMapping: jest.fn() } as unknown as ColumnMapperService,
        { validateAll: jest.fn().mockImplementation((ctx: any) => ctx.validatedRows) } as unknown as RowValidatorService,
        { normalizeAll: jest.fn().mockImplementation((ctx: any) => ctx.normalizedRows) } as unknown as RowNormalizerService,
        { execute: jest.fn() } as unknown as BatchExecutorService,
      );

      const preview = await richService.preview(Buffer.from('file'), 'test.xlsx', 'user-1', {});

      expect(preview.distinctValuesByColumn.CATEGORIA).toEqual([
        { value: 'Video', count: 3 },
        { value: 'Control de Acceso', count: 1 },
      ]);
    });
  });

  describe('execute', () => {
    it('reemplaza el listaId del preview con el enviado en execute', async () => {
      const preview = await runPreview('lista-preview');

      await service.execute(preview.importId, { columnMappings: [], listaId: 'lista-exec' }, 'user-1');

      const ctx = batchExecutor.execute.mock.calls[0][1];
      expect(ctx.listaId).toBe('lista-exec');
    });

    it('conserva el listaId del preview cuando execute no lo envía', async () => {
      const preview = await runPreview('lista-preview');

      await service.execute(preview.importId, { columnMappings: [] }, 'user-1');

      const ctx = batchExecutor.execute.mock.calls[0][1];
      expect(ctx.listaId).toBe('lista-preview');
    });

    it('propaga el contexto (incluyendo listaId) al batch executor', async () => {
      const preview = await runPreview('lista-x');

      await service.execute(preview.importId, { columnMappings: [] }, 'user-1');

      expect(batchExecutor.execute).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ listaId: 'lista-x', importId: preview.importId }),
      );
    });

    it('transporta las decisiones de secciones al contexto del batch executor (normalizadas por slug)', async () => {
      const preview = await runPreview();

      await service.execute(
        preview.importId,
        {
          columnMappings: [],
          sections: [
            { sourceValue: 'cctv', targetName: 'CCTV', action: 'create' },
            { sourceValue: 'DVR', action: 'skip' },
          ],
        },
        'user-1',
      );

      const ctx = batchExecutor.execute.mock.calls[0][1];
      expect(ctx.sectionDecisions).toEqual({
        cctv: { targetName: 'CCTV', action: 'create' },
        dvr: { action: 'skip' },
      });
    });
  });
});