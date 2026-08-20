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
      toPreset: jest.fn().mockImplementation((m: any, name: string, userId: string, isDefault = false) => ({
        name,
        mappings: m.entries.map((e: any) => ({
          sourceColumn: e.sourceColumn,
          targetField: e.targetField,
        })),
        userId,
        isDefault,
      })),
      applyPreset: jest.fn().mockReturnValue({ ...mapping, confirmed: true }),
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

  describe('getCurrentPriceBySku (wizard de precios)', () => {
    it('devuelve data null cuando no existe producto para el SKU', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const res = await service.getCurrentPriceBySku('SKU-NO-EXISTE');

      expect(res).toEqual({ data: null });
    });

    it('busca el SKU case-insensitive con mode insensitive', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([]);

      await service.getCurrentPriceBySku('  sku-1  ');

      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.sku).toEqual({ equals: 'sku-1', mode: 'insensitive' });
      expect(where.listaId).toBeUndefined();
    });

    it('devuelve el precio vigente más reciente (exists true)', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60 * 60 * 1000);
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([
        { value: 1000, currency: 'COP', validFrom: null, validUntil: null, updatedAt: earlier },
        { value: 950, currency: 'COP', validFrom: null, validUntil: later, updatedAt: later },
      ]);

      const res = await service.getCurrentPriceBySku('SKU-1');

      expect(res.data).toEqual({
        sku: 'SKU-1',
        productId: 'prod-1',
        name: 'Prod 1',
        price: 950,
        currency: 'COP',
        validUntil: later,
        exists: true,
      });
    });

    it('descarta precios vencidos aunque sean los más recientes', async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const now = new Date();
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([
        { value: 900, currency: 'COP', validFrom: null, validUntil: past, updatedAt: now },
        { value: 700, currency: 'COP', validFrom: null, validUntil: past, updatedAt: past },
      ]);

      const res = await service.getCurrentPriceBySku('SKU-1');

      expect(res.data).toEqual({
        sku: 'SKU-1',
        productId: 'prod-1',
        name: 'Prod 1',
        price: null,
        currency: null,
        validUntil: null,
        exists: false,
      });
    });

    it('devuelve exists false cuando el producto existe pero no hay precio vigente', async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([
        { value: 1000, currency: 'COP', validFrom: null, validUntil: past, updatedAt: past },
      ]);

      const res = await service.getCurrentPriceBySku('SKU-1');

      expect(res.data).toEqual({
        sku: 'SKU-1',
        productId: 'prod-1',
        name: 'Prod 1',
        price: null,
        currency: null,
        validUntil: null,
        exists: false,
      });
    });

    it('filtra producto y precios por listaId cuando llega el query', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([]);

      await service.getCurrentPriceBySku('SKU-1', 'lista-x');

      const productWhere = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(productWhere.listaId).toBe('lista-x');
      const priceWhere = mockPrisma.price.findMany.mock.calls[0][0].where;
      expect(priceWhere.productId).toBe('prod-1');
      expect(priceWhere.listaId).toBe('lista-x');
    });

    it('hace fallback al precio global (sin listaId) cuando no hay precios con el listaId de la lista (precios importados con listaId null)', async () => {
      const now = new Date();
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany
        .mockResolvedValueOnce([]) // con listaId → vacío
        .mockResolvedValueOnce([
          { value: 1200, currency: 'COP', validFrom: null, validUntil: null, updatedAt: now },
        ]);

      const res = await service.getCurrentPriceBySku('SKU-1', 'lista-x');

      expect(res.data).toEqual({
        sku: 'SKU-1',
        productId: 'prod-1',
        name: 'Prod 1',
        price: 1200,
        currency: 'COP',
        validUntil: null,
        exists: true,
      });
      const firstWhere = mockPrisma.price.findMany.mock.calls[0][0].where;
      expect(firstWhere.listaId).toBe('lista-x');
      const secondWhere = mockPrisma.price.findMany.mock.calls[1][0].where;
      expect(secondWhere.listaId).toBeUndefined();
    });

    it('no hace fallback cuando existe al menos un precio con el listaId de la lista', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1', name: 'Prod 1' },
      ]);
      mockPrisma.price.findMany.mockResolvedValue([
        { value: 1000, currency: 'COP', validFrom: null, validUntil: null, updatedAt: new Date() },
      ]);

      const res = await service.getCurrentPriceBySku('SKU-1', 'lista-x');

      expect(res.data?.exists).toBe(true);
      expect(mockPrisma.price.findMany).toHaveBeenCalledTimes(1);
    });

    it('devuelve data null para SKU vacío', async () => {
      const res = await service.getCurrentPriceBySku('');
      expect(res).toEqual({ data: null });
    });
  });
});

describe('ImportService — savePreset (normalización de mapping 500)', () => {
  let service: ImportService;
  let mockPrismaLocal: any;
  let mockColumnMapper: { toPreset: jest.Mock };

  const presetRow = {
    id: 'preset-1',
    name: 'Mi preset',
    mappings: [
      { sourceColumn: 'REFERENCIA', targetField: 'sku' },
      { sourceColumn: 'DESCRIPCION', targetField: 'name' },
    ],
    userId: 'user-1',
    isDefault: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockPrismaLocal = createPrismaMock();
    mockPrismaLocal.importMapping = {
      findMany: jest.fn().mockResolvedValue([presetRow]),
      findUnique: jest.fn().mockResolvedValue(presetRow),
      create: jest.fn().mockImplementation(async (args: any) => ({
        id: 'preset-new',
        name: args.data.name,
        mappings: args.data.mappings,
        userId: args.data.userId,
        isDefault: args.data.isDefault,
        createdAt: new Date(),
      })),
      delete: jest.fn().mockResolvedValue({}),
    };

    mockColumnMapper = {
      toPreset: jest.fn().mockImplementation((m: any, name: string, userId: string, isDefault = false) => ({
        name,
        mappings: m.entries.map((e: any) => ({
          sourceColumn: e.sourceColumn,
          targetField: e.targetField,
        })),
        userId,
        isDefault,
      })),
    };

    service = new ImportService(
      mockPrismaLocal,
      { log: jest.fn().mockResolvedValue(undefined), prisma: {} as any, isGlobalAuditor: jest.fn(), findAll: jest.fn(), findByEntity: jest.fn() } as unknown as AuditService,
      { parse: jest.fn() } as unknown as ExcelAdapter,
      { detect: jest.fn() } as unknown as HeaderDetectorService,
      mockColumnMapper as unknown as ColumnMapperService,
      { validateAll: jest.fn() } as unknown as RowValidatorService,
      { normalizeAll: jest.fn() } as unknown as RowNormalizerService,
      { execute: jest.fn() } as unknown as BatchExecutorService,
    );
  });

  it('201: guarda un preset con mapping array plano [{sourceColumn,targetField}] (formato de la UI)', async () => {
    const res = await service.savePreset(
      [
        { sourceColumn: 'REFERENCIA', targetField: 'sku' as const },
        { sourceColumn: 'DESCRIPCION', targetField: 'name' as const },
      ],
      'Mi preset',
      'user-1',
    );

    // La entrada array se normalizó a formato interno {entries, confirmed} antes de toPreset.
    expect(mockColumnMapper.toPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ sourceColumn: 'REFERENCIA', targetField: 'sku' }),
          expect.objectContaining({ sourceColumn: 'DESCRIPCION', targetField: 'name' }),
        ]),
        confirmed: true,
      }),
      'Mi preset',
      'user-1',
      false,
    );
    // Persiste en el formato de lectura esperado por el frontend (mappings array).
    expect(mockPrismaLocal.importMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Mi preset',
          mappings: [
            { sourceColumn: 'REFERENCIA', targetField: 'sku' },
            { sourceColumn: 'DESCRIPCION', targetField: 'name' },
          ],
          userId: 'user-1',
        }),
      }),
    );
    expect(res.id).toBe('preset-new');
    expect(res.mappings).toEqual([
      { sourceColumn: 'REFERENCIA', targetField: 'sku' },
      { sourceColumn: 'DESCRIPCION', targetField: 'name' },
    ]);
  });

  it('GET devuelve el mapping en el formato de lectura esperado (mappings array)', async () => {
    const list = await service.listPresets('user-1');
    expect(list).toHaveLength(1);
    expect(list[0].mappings).toEqual([
      { sourceColumn: 'REFERENCIA', targetField: 'sku' },
      { sourceColumn: 'DESCRIPCION', targetField: 'name' },
    ]);

    const one = await service.getPreset('preset-1');
    expect(one?.mappings).toEqual(list[0].mappings);
  });

  it('compatibilidad: sigue funcionando el formato antiguo {entries, confirmed} (uso interno de execute)', async () => {
    const res = await service.savePreset(
      {
        entries: [
          { sourceColumn: 'REFERENCIA', targetField: 'sku', isRequired: true, confidence: 1 },
          { sourceColumn: 'DESCRIPCION', targetField: 'name', isRequired: true, confidence: 1 },
        ],
        confirmed: true,
      },
      'Preset interno',
      'user-1',
    );

    expect(mockColumnMapper.toPreset).toHaveBeenCalledWith(
      expect.objectContaining({ entries: expect.arrayContaining([expect.objectContaining({ sourceColumn: 'REFERENCIA' })]) }),
      'Preset interno',
      'user-1',
      false,
    );
    expect(res.mappings).toEqual([
      { sourceColumn: 'REFERENCIA', targetField: 'sku' },
      { sourceColumn: 'DESCRIPCION', targetField: 'name' },
    ]);
  });
});