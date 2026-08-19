import { RowNormalizerService } from './row-normalizer.service';
import { ImportContext, ValidatedRow } from '../interfaces/import-context';
import { ColumnMapping, SystemField } from '../interfaces/column-mapping';

describe('RowNormalizerService', () => {
  let service: RowNormalizerService;

  const makeMapping = (
    entries: Array<{ sourceColumn: string; targetField: SystemField }>,
  ): ColumnMapping => ({
    entries: entries.map((e) => ({
      ...e,
      isRequired: e.targetField === 'sku' || e.targetField === 'name',
      confidence: 1,
    })),
    confirmed: true,
  });

  const makeValidatedRow = (
    rowIndex: number,
    rawData: Record<string, unknown>,
  ): ValidatedRow => ({
    rowIndex,
    rawData,
    isValid: true,
    errors: [],
    warnings: [],
  });

  const makeContext = (overrides: Partial<ImportContext>): ImportContext =>
    ({
      importId: 'import-1',
      userId: 'user-1',
      fileName: 'test.xlsx',
      fileSize: 1024,
      rawRows: [],
      headers: [],
      columnMapping: makeMapping([
        { sourceColumn: 'SKU', targetField: 'sku' },
        { sourceColumn: 'NOMBRE', targetField: 'name' },
      ]),
      ivaMode: 'with_iva',
      validatedRows: [],
      normalizedRows: [],
      pipelineErrors: [],
      startedAt: new Date(),
      currentStage: 'normalization',
      ...overrides,
    }) as ImportContext;

  beforeEach(() => {
    service = new RowNormalizerService();
  });

  describe('fixedValues', () => {
    it('aplica fixedValues cuando no hay columnas mapeadas a brand/category', () => {
      const ctx = makeContext({
        fixedValues: { brand: 'Hikvision', category: 'CCTV' },
        validatedRows: [
          makeValidatedRow(0, { SKU: 'SKU-1', NOMBRE: 'Cámara IP' }),
          makeValidatedRow(1, { SKU: 'SKU-2', NOMBRE: 'DVR' }),
        ],
      });

      const rows = service.normalizeAll(ctx);

      expect(rows).toHaveLength(2);
      expect(rows[0].brandName).toBe('Hikvision');
      expect(rows[0].categoryName).toBe('CCTV');
      expect(rows[1].brandName).toBe('Hikvision');
      expect(rows[1].categoryName).toBe('CCTV');
    });

    it('la columna mapeada a category gana sobre el fixedValue', () => {
      const ctx = makeContext({
        columnMapping: makeMapping([
          { sourceColumn: 'SKU', targetField: 'sku' },
          { sourceColumn: 'NOMBRE', targetField: 'name' },
          { sourceColumn: 'CATEGORIA', targetField: 'category' },
        ]),
        fixedValues: { category: 'CCTV' },
        validatedRows: [
          makeValidatedRow(0, {
            SKU: 'SKU-1',
            NOMBRE: 'Cámara IP',
            CATEGORIA: 'Accesorios',
          }),
        ],
      });

      const [row] = service.normalizeAll(ctx);

      expect(row.categoryName).toBe('Accesorios');
    });

    it('usa el fixedValue cuando la celda de la columna mapeada a brand viene vacía', () => {
      const ctx = makeContext({
        columnMapping: makeMapping([
          { sourceColumn: 'SKU', targetField: 'sku' },
          { sourceColumn: 'NOMBRE', targetField: 'name' },
          { sourceColumn: 'MARCA', targetField: 'brand' },
        ]),
        fixedValues: { brand: 'Hikvision' },
        validatedRows: [
          makeValidatedRow(0, { SKU: 'SKU-1', NOMBRE: 'Cámara IP', MARCA: '' }),
          makeValidatedRow(1, { SKU: 'SKU-2', NOMBRE: 'DVR', MARCA: null }),
        ],
      });

      const rows = service.normalizeAll(ctx);

      expect(rows[0].brandName).toBe('Hikvision');
      expect(rows[1].brandName).toBe('Hikvision');
    });
  });
});
