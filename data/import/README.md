# Directorio de Importación de Datos Comerciales

> Proyecto **Grupo Security Office / Plataforma Comercial Grupo Security**.

## Ubicación esperada del archivo fuente

```
data/import/<archivo-proveedor>.xlsx | .csv
```

## Reglas obligatorias

1. **El archivo original (proveedor) es inmutable** — No modificar, no versionar.
2. **Información privada** — Puede contener precios, PII y datos comerciales. No commitear.
3. **Solo lectura** — Los agentes de mapeo/import leen desde aquí; nunca escriben aquí.
4. **Backup** — Mantener copia de seguridad externa antes de cualquier importación.

## Flujo de importación

1. `excel-mapping-architect` define el contrato de mapeo, las reglas de validación y el reporte de filas rechazadas.
2. `python-excel-toolsmith` implementa la utilidad Python de mapeo/validación según el contrato aprobado.
3. `GS Excel Import Implementer` (Kilo) integra el resultado aprobado en la aplicación NestJS/Prisma.
4. `data-migration-engineer` revisa el riesgo de datos (duplicados, nulos, invariantes Lista/Producto/Precio).

## .gitignore

```
data/import/*
!data/import/.gitkeep
!data/import/README.md
```

## Tests

- Los tests usan **fixtures totalmente ficticios**.
- Nunca usan el archivo real de `data/import/`.
- El backend es NestJS + Prisma; Python es solo herramienta auxiliar.