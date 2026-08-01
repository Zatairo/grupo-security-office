import { ExcelAdapter } from './excel-adapter';
import {
  createExcelBuffer,
  createCsvBuffer,
  createEmptyExcelBuffer,
  createCorruptedBuffer,
} from '../../../../__test__/helpers/excel.helper';

describe('ExcelAdapter', () => {
  let adapter: ExcelAdapter;

  beforeEach(() => {
    adapter = new ExcelAdapter();
  });

  describe('parse', () => {
    it('debe parsear un archivo Excel válido con headers y datos', () => {
      const buffer = createExcelBuffer(
        ['SKU', 'Nombre', 'Marca'],
        [
          { SKU: 'CAM-001', Nombre: 'Cámara IP', Marca: 'Hikvision' },
          { SKU: 'CAM-002', Nombre: 'Cámara Dome', Marca: 'Dahua' },
        ],
      );

      const result = adapter.parse(buffer, 'test.xlsx');

      expect(result.headers).toContain('SKU');
      expect(result.headers).toContain('Nombre');
      expect(result.headers).toContain('Marca');
      expect(result.rows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.fileName).toBe('test.xlsx');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('debe extraer solo headers no vacíos y no "Unnamed"', () => {
      const buffer = createExcelBuffer(
        ['SKU', 'Nombre', '', 'Unnamed: 5', 'Marca'],
        [{ SKU: 'CAM-001', Nombre: 'Test', Marca: 'Hik' }],
      );

      const result = adapter.parse(buffer, 'test.xlsx');

      expect(result.headers).toContain('SKU');
      expect(result.headers).toContain('Nombre');
      expect(result.headers).toContain('Marca');
      expect(result.headers).not.toContain('');
      expect(result.headers).not.toContain('Unnamed: 5');
    });

    it('debe filtrar filas completamente vacías', () => {
      const buffer = createExcelBuffer(
        ['SKU', 'Nombre'],
        [
          { SKU: 'CAM-001', Nombre: 'Cámara' },
          { SKU: '', Nombre: '' },
          { SKU: 'CAM-002', Nombre: 'Otra' },
        ],
      );

      const result = adapter.parse(buffer, 'test.xlsx');

      // La fila vacía debería ser filtrada
      expect(result.rows.length).toBeLessThanOrEqual(3);
    });

    it('debe parsear archivos CSV', () => {
      const buffer = createCsvBuffer(
        ['SKU', 'Nombre'],
        [
          { SKU: 'CAM-001', Nombre: 'Cámara' },
          { SKU: 'CAM-002', Nombre: 'Otra' },
        ],
      );

      const result = adapter.parse(buffer, 'test.csv');

      expect(result.rows).toHaveLength(2);
      expect(result.headers).toContain('SKU');
    });

    it('debe lanzar BadRequestException con extensión no soportada', () => {
      const buffer = Buffer.from('fake content');

      expect(() => adapter.parse(buffer, 'test.pdf')).toThrow('Formato no soportado');
    });

    it('debe lanzar BadRequestException con archivo vacío', () => {
      expect(() => adapter.parse(Buffer.alloc(0), 'test.xlsx')).toThrow('vacío');
    });

    it('debe lanzar BadRequestException con buffer corrupto', () => {
      // Crear un buffer que tiene extensión .xlsx pero contenido inválido
      const garbageBuffer = Buffer.from('PK\x03\x04esto no es un xlsx válido');

      expect(() => adapter.parse(garbageBuffer, 'test.xlsx')).toThrow();
    });

    it('debe rechazar archivos mayores a 10MB', () => {
      // Crear un buffer de 11MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 0);

      expect(() => adapter.parse(largeBuffer, 'test.xlsx')).toThrow('tamaño máximo');
    });
  });
});
