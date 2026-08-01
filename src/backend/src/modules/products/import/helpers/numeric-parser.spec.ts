import { parseNumericValue, isNumericLike } from './numeric-parser';

describe('parseNumericValue', () => {
  it('debe parsear formato colombiano: 1.500.000 → 1500000', () => {
    expect(parseNumericValue('1.500.000')).toBe(1500000);
  });

  it('debe parsear formato US: 1,500,000.50 → 1500000.50', () => {
    expect(parseNumericValue('1,500,000.50')).toBe(1500000.50);
  });

  it('debe parsear formato mixto: 1.500.000,50 → 1500000.50', () => {
    expect(parseNumericValue('1.500.000,50')).toBe(1500000.50);
  });

  it('debe remover símbolo de moneda: $1.500.000 → 1500000', () => {
    expect(parseNumericValue('$1.500.000')).toBe(1500000);
  });

  it('debe remover prefijo COP: COP 1500000 → 1500000', () => {
    expect(parseNumericValue('COP 1500000')).toBe(1500000);
  });

  it('debe retornar null para valores no numéricos', () => {
    expect(parseNumericValue('abc')).toBeNull();
    expect(parseNumericValue('hello world')).toBeNull();
  });

  it('debe retornar null para string vacío', () => {
    expect(parseNumericValue('')).toBeNull();
    expect(parseNumericValue(null)).toBeNull();
    expect(parseNumericValue(undefined)).toBeNull();
  });

  it('debe funcionar con números ya parseados', () => {
    expect(parseNumericValue(1500000)).toBe(1500000);
    expect(parseNumericValue(0)).toBe(0);
    expect(parseNumericValue(NaN)).toBeNull();
  });

  it('debe parsear números pequeños correctamente', () => {
    expect(parseNumericValue('150')).toBe(150);
    expect(parseNumericValue('1.500')).toBe(1500);
    expect(parseNumericValue('1500')).toBe(1500);
  });

  it('debe manejar espacios extra', () => {
    expect(parseNumericValue('  1.500.000  ')).toBe(1500000);
    expect(parseNumericValue(' $ 1.500.000 ')).toBe(1500000);
  });
});

describe('isNumericLike', () => {
  it('debe retornar true para strings numéricos', () => {
    expect(isNumericLike('1500000')).toBe(true);
    expect(isNumericLike('1.500.000')).toBe(true);
    expect(isNumericLike('$150')).toBe(true);
    expect(isNumericLike('COP 1500')).toBe(true);
  });

  it('debe retornar false para strings de texto', () => {
    expect(isNumericLike('abc')).toBe(false);
    expect(isNumericLike('hello')).toBe(false);
    expect(isNumericLike('')).toBe(false);
  });

  it('debe retornar true para números', () => {
    expect(isNumericLike(1500)).toBe(true);
    expect(isNumericLike(0)).toBe(true);
  });

  it('debe retornar false para null/undefined', () => {
    expect(isNumericLike(null)).toBe(false);
    expect(isNumericLike(undefined)).toBe(false);
  });
});
