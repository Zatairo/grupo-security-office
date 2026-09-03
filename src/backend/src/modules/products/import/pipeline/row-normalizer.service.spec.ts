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

  describe('derivación de nombre desde descripción', () => {
    const DVR_DESCRIPTION =
      'DVR Lite Mini 1U H.265 de 4 canales y 1080p metalico Compatible con la tecnología de detección de movimiento de todos los canales Compresión de vídeo H.265 Pro+/H.265 Pro/H.265 Pro';

    const makeDescriptionOnlyContext = (rows: Array<{ SKU: string; DESCRIPCION: string }>) =>
      makeContext({
        columnMapping: makeMapping([
          { sourceColumn: 'SKU', targetField: 'sku' },
          { sourceColumn: 'DESCRIPCION', targetField: 'description' },
        ]),
        validatedRows: rows.map((r, i) => makeValidatedRow(i, r)),
      });

    it('deriva el nombre desde una descripción extensa de DVR y conserva la descripción completa', () => {
      const sku = 'DS-7204HGHI-M1T';
      const ctx = makeDescriptionOnlyContext([{ SKU: sku, DESCRIPCION: DVR_DESCRIPTION }]);

      const [row] = service.normalizeAll(ctx);

      expect(row.sku).toBe(sku);
      expect(row.name).toBe('DVR Lite Mini 1U H.265 de 4 canales y 1080p metalico');
      expect(row.name).not.toContain(sku);
      expect(row.description).toContain('DVR Lite Mini 1U H.265 de 4 canales y 1080p metalico');
      expect(row.description).toContain('Compatible');
      expect(row.description).toContain('Compresión');
    });

    it('iDS-7216HQHI-M2/FA con descripción extensa queda válida (name <= 120, description completa)', () => {
      const sku = 'iDS-7216HQHI-M2/FA';
      const ctx = makeDescriptionOnlyContext([{ SKU: sku, DESCRIPCION: DVR_DESCRIPTION }]);

      const [row] = service.normalizeAll(ctx);

      // normalizeSku normaliza a mayúsculas (iDS- → IDS-).
      expect(row.sku).toBe(sku.toUpperCase());
      expect(row.name.length).toBeLessThanOrEqual(120);
      expect(row.name).not.toContain(sku.toUpperCase());
      // description no se trunca: conserva los tokens tras el corte del nombre.
      expect(row.description.includes('Compatible')).toBe(true);
    });

    it('iDS-9016HUHI-M8S con descripción extensa queda válida (name <= 120, description completa)', () => {
      const sku = 'iDS-9016HUHI-M8S';
      const ctx = makeDescriptionOnlyContext([{ SKU: sku, DESCRIPCION: DVR_DESCRIPTION }]);

      const [row] = service.normalizeAll(ctx);

      expect(row.sku).toBe(sku.toUpperCase());
      expect(row.name.length).toBeLessThanOrEqual(120);
      expect(row.name).not.toContain(sku.toUpperCase());
      expect(row.description.includes('Compresión')).toBe(true);
    });

    it('el nombre explícito prevalece y no se resume', () => {
      const ctx = makeContext({
        columnMapping: makeMapping([
          { sourceColumn: 'SKU', targetField: 'sku' },
          { sourceColumn: 'NOMBRE', targetField: 'name' },
          { sourceColumn: 'DESCRIPCION', targetField: 'description' },
        ]),
        validatedRows: [
          makeValidatedRow(0, {
            SKU: 'SKU-EXPL',
            NOMBRE: 'Nombre Correcto',
            DESCRIPCION: DVR_DESCRIPTION,
          }),
        ],
      });

      const [row] = service.normalizeAll(ctx);

      expect(row.name).toBe('Nombre Correcto');
      expect(row.name).not.toContain('SKU-EXPL');
      expect(row.description).toBe(DVR_DESCRIPTION);
    });

    it('solo separador no genera nombre válido (name vacío)', () => {
      const ctx = makeDescriptionOnlyContext([
        { SKU: 'SKU-SEP', DESCRIPCION: 'TITLE HIKVISION TURBO' },
      ]);

      const [row] = service.normalizeAll(ctx);

      expect(row.name).toBe('');
    });

    it('sin nombre ni descripción no genera un nombre ficticio (name vacío)', () => {
      const ctx = makeDescriptionOnlyContext([{ SKU: 'SKU-EMPTY', DESCRIPCION: '' }]);

      const [row] = service.normalizeAll(ctx);

      expect(row.name).toBe('');
    });

    it('describe larga sin frase de corte: name <= 120, sin palabra partida y sin SKU', () => {
      const sku = 'SKU-LARGO';
      const longDescription =
        'Cámara de seguridad IP Hikvision con resolución 4MP, lente motorizado 2.8-12mm, ' +
        'casco IP67, alimentación PoE, socket múltiple, doble tarjeta SD y arranque rápido para ' +
        'la vigilancia perimetral de recintos amplios en exteriores';

      const ctx = makeDescriptionOnlyContext([{ SKU: sku, DESCRIPCION: longDescription }]);

      const [row] = service.normalizeAll(ctx);

      expect(row.name.length).toBeLessThanOrEqual(120);
      expect(row.name).not.toContain(sku);
      // No termina en espacio/puntuación: no quedó una palabra partida en la cola.
      expect(row.name).toMatch(/[a-zA-Z0-9]$/);
    });
  });
});
