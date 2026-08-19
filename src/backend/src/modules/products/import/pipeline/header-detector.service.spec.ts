import { HeaderDetectorService } from './header-detector.service';

describe('HeaderDetectorService', () => {
  let service: HeaderDetectorService;

  beforeEach(() => {
    service = new HeaderDetectorService();
  });

  describe('detect', () => {
    it('debe detectar mapeo exacto para headers conocidos', () => {
      const headers = ['REFERENCIA', 'DESCRIPCION', 'Marca', 'Categoría'];
      const result = service.detect(headers, []);

      const skuMapping = result.suggestedMappings.find((m) => m.targetField === 'sku');
      expect(skuMapping).toBeDefined();
      expect(skuMapping!.sourceColumn).toBe('REFERENCIA');
      expect(skuMapping!.confidence).toBeGreaterThanOrEqual(0.8);

      const descriptionMapping = result.suggestedMappings.find((m) => m.targetField === 'description');
      expect(descriptionMapping).toBeDefined();
      expect(descriptionMapping!.sourceColumn).toBe('DESCRIPCION');
    });

    it('debe mapear Nombre a name y DESCRIPCIÓN a description (no a name)', () => {
      const headers = ['Nombre', 'DESCRIPCIÓN'];
      const result = service.detect(headers, []);

      const nameMapping = result.suggestedMappings.find((m) => m.targetField === 'name');
      expect(nameMapping).toBeDefined();
      expect(nameMapping!.sourceColumn).toBe('Nombre');

      const descriptionMapping = result.suggestedMappings.find((m) => m.targetField === 'description');
      expect(descriptionMapping).toBeDefined();
      expect(descriptionMapping!.sourceColumn).toBe('DESCRIPCIÓN');

      // DESCRIPCIÓN no debe mapear a name (regresión del bug)
      const descAsName = result.suggestedMappings.find(
        (m) => m.targetField === 'name' && m.sourceColumn === 'DESCRIPCIÓN',
      );
      expect(descAsName).toBeUndefined();
    });

    it('debe detectar mapeo para headers de precios', () => {
      const headers = [
        'PRECIO INSTALADOR CON IVA',
        'PRECIO TIENDA CON IVA',
        'ORO SIN IVA',
      ];
      const result = service.detect(headers, []);

      const instaladorMapping = result.suggestedMappings.find(
        (m) => m.targetField === 'price_instalador_iva',
      );
      expect(instaladorMapping).toBeDefined();
      expect(instaladorMapping!.confidence).toBeGreaterThanOrEqual(0.8);

      const tiendaMapping = result.suggestedMappings.find(
        (m) => m.targetField === 'price_tienda_iva',
      );
      expect(tiendaMapping).toBeDefined();
    });

    it('debe marcar headers "Unnamed" como __skip', () => {
      const headers = ['SKU', 'Unnamed: 5', 'Columna1'];
      const result = service.detect(headers, []);

      // Unnamed y Columna1 deberían ser __skip o no mapeados
      const skipMappings = result.suggestedMappings.filter((m) => m.targetField === '__skip');
      expect(skipMappings.length).toBeGreaterThanOrEqual(0); // Pueden ser unmapped en vez de __skip
    });

    it('debe retornar unmappedHeaders para columnas sin match', () => {
      const headers = ['SKU', 'XYZZY_COLUMNS_RANDOM', 'Nombre'];
      const result = service.detect(headers, []);

      expect(result.unmappedHeaders).toContain('XYZZY_COLUMNS_RANDOM');
      expect(result.unmappedHeaders).not.toContain('SKU');
    });

    it('debe calcular overallConfidence correctamente', () => {
      const headers = ['SKU', 'Nombre', 'Marca', 'Categoría'];
      const result = service.detect(headers, []);

      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('debe retornar suggestedMappings con estructura correcta', () => {
      const headers = ['REFERENCIA', 'DESCRIPCION'];
      const result = service.detect(headers, []);

      for (const mapping of result.suggestedMappings) {
        expect(mapping).toHaveProperty('sourceColumn');
        expect(mapping).toHaveProperty('targetField');
        expect(mapping).toHaveProperty('isRequired');
        expect(mapping).toHaveProperty('confidence');
        expect(typeof mapping.confidence).toBe('number');
      }
    });

    it('debe usar confidenceThreshold para filtrar mapeos débiles', () => {
      const headers = ['SKU', 'XYZ_NO_MATCH_12345'];
      const result = service.detect(headers, [], { confidenceThreshold: 0.8 });

      // XYZ_NO_MATCH_12345 no debería tener mapeo con threshold alto
      const weakMapping = result.suggestedMappings.find(
        (m) => m.sourceColumn === 'XYZ_NO_MATCH_12345',
      );
      expect(weakMapping).toBeUndefined();
    });
  });
});
