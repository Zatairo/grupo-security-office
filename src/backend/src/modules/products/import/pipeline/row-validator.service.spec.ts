import { RowValidatorService } from './row-validator.service';
import { ColumnMapping, SystemField } from '../interfaces/column-mapping';
import { RawRow } from '../interfaces/import-source.adapter';

describe('RowValidatorService', () => {
  let service: RowValidatorService;

  const validMapping: ColumnMapping = {
    entries: [
      { sourceColumn: 'SKU', targetField: 'sku', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'Nombre', targetField: 'name', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'Categoría', targetField: 'category', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'Marca', targetField: 'brand', isRequired: true, confidence: 1.0 },
      { sourceColumn: 'Precio', targetField: 'price_instalador_iva', isRequired: false, confidence: 0.9 },
    ],
    confirmed: true,
  };

  beforeEach(() => {
    service = new RowValidatorService();
  });

  describe('validateRow', () => {
    it('debe detectar SKU vacío', () => {
      const rawRow: RawRow = {
        SKU: '',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('sku');
      expect(errors[0].code).toBe('SKU_REQUIRED');
    });

    it('debe detectar SKU duplicado en el archivo', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
      };

      const seenSkus = new Map<string, number>([['CAM-001', 0]]);

      const errors = service.validateRow(rawRow, validMapping, seenSkus, 1);

      const skuErrors = errors.filter((e) => e.field === 'sku');
      expect(skuErrors.length).toBeGreaterThanOrEqual(1);
      expect(skuErrors[0].code).toBe('SKU_DUPLICATE');
    });

    it('debe detectar nombre vacío', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: '',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      const nameErrors = errors.filter((e) => e.field === 'name');
      expect(nameErrors).toHaveLength(1);
      expect(nameErrors[0].code).toBe('NAME_REQUIRED');
    });

    it('debe detectar categoría vacía', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': '',
        Marca: 'Hikvision',
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      // Category is now optional — empty category should NOT produce errors
      const categoryErrors = errors.filter((e) => e.field === 'category');
      expect(categoryErrors).toHaveLength(0);
    });

    it('debe aceptar marca vacía (es opcional, se usa default)', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: '',
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      // Brand is now optional — empty brand should NOT produce errors
      const brandErrors = errors.filter((e) => e.field === 'brand');
      expect(brandErrors).toHaveLength(0);
    });

    it('debe detectar precio inválido (no numérico)', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
        Precio: 'no-es-numero',
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      const priceErrors = errors.filter((e) => e.field === 'price_instalador_iva');
      expect(priceErrors).toHaveLength(1);
      expect(priceErrors[0].code).toBe('PRICE_INVALID');
    });

    it('debe detectar precio negativo', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
        Precio: -500,
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      const priceErrors = errors.filter((e) => e.field === 'price_instalador_iva');
      expect(priceErrors).toHaveLength(1);
      expect(priceErrors[0].code).toBe('PRICE_NEGATIVE');
    });

    it('debe aceptar fila válida sin errores', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
        Precio: 1500000,
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      expect(errors).toHaveLength(0);
    });

    it('debe detectar precio excesivamente alto', () => {
      const rawRow: RawRow = {
        SKU: 'CAM-001',
        Nombre: 'Cámara IP',
        'Categoría': 'CCTV',
        Marca: 'Hikvision',
        Precio: 999999999999,
      };

      const errors = service.validateRow(rawRow, validMapping, new Map(), 0);

      const priceErrors = errors.filter((e) => e.field === 'price_instalador_iva');
      expect(priceErrors).toHaveLength(1);
      expect(priceErrors[0].code).toBe('PRICE_TOO_HIGH');
    });
  });
});
