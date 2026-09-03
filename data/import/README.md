# Directorio de Importación de Datos Financieros

## Ubicación esperada del archivo fuente

```
data/import/FINANZAS-1_1.xlsx
```

## Reglas obligatorias

1. **El archivo original es inmutable** — No modificar, no versionar.
2. **Información privada** — Contiene datos financieros reales (PII, montos, cuentas). No commitear.
3. **Solo lectura** — Los agentes de migración leen desde aquí; nunca escriben aquí.
4. **Backup** — Mantener copia de seguridad externa antes de cualquier migración.

## Flujo de migración

1. `data-migration-engineer` audita el archivo en `data/import/`
2. Genera informe de calidad en `docs/migration/quality-report.md`
3. Migra a PostgreSQL via scripts idempotentes
4. Conciliación totales mes a mes (fuente vs BD)
5. Reporte de excepciones en `docs/migration/exceptions-report.md`

## .gitignore

```
data/import/*
!data/import/.gitkeep
!data/import/README.md
```

## Tests

- Los tests usan **fixtures totalmente ficticios** en `tests/fixtures/`
- Nunca usan el archivo real de `data/import/`