# Enriquecedor de Catálogo Hikvision

## Propósito

`enrich_hikvision_catalog.py` es una herramienta de línea de comandos **externa, de solo lectura**, que enriquece una lista de SKU de Hikvision consultando **páginas públicas oficiales de `hikvision.com`** usando un navegador real (Playwright + Chromium).

- Usa **Playwright con Chromium headless** para renderizar páginas dinámicas (Hikvision es una SPA).
- No requiere credenciales, cookies ni tokens.
- Descarga imágenes y metadatos cuando el SKU se confirma de forma estricta contra contenido oficial.

## Qué hace

1. Lee una lista de productos desde un archivo **CSV** o **XLSX**.
2. Identifica la columna que contiene el SKU/referencia (manual o automática).
3. Normaliza cada SKU internamente (mayúsculas, trim, colapso de espacios).
4. Navega por categorías oficiales de Hikvision con Playwright para encontrar URLs de productos.
5. Valida estrictamente que el SKU aparezca en:
   - Título visible (`<title>`)
   - Metadato `og:title`
   - JSON-LD (`application/ld+json`)
   - Texto visible principal
   - URL canónica
6. Extrae información comercial y técnica disponible públicamente:
   - Nombre del producto, descripción, categoría (breadcrumb).
   - Especificaciones técnicas desde tablas y JSON-LD.
   - URLs oficiales de imágenes y PDFs (datasheet, manual, quick-start).
7. Descarga imágenes oficiales (hasta `--max-images`) **solo si el SKU coincide exactamente**.
8. Marca cada SKU con un estado claro (`matched`, `partial`, `ambiguous`, `not_found`, `invalid_sku`, `error`).
9. Genera archivos de salida para revisión humana:
   - `catalogo_hikvision_enriquecido.xlsx`
   - `catalogo_hikvision_enriquecido.csv`
   - `catalogo_hikvision_especificaciones.json`
   - `enrichment_log.csv`
   - `images/` (imágenes descargadas)
10. Usa caché de categorías para acelerar el procesamiento de lotes.

## Qué **no** hace

- No forzar el acceso a contenidos restringidos.
- No persiste datos en la base de datos del backend.
- No sustituye precios ni información comercial.
- No utiliza servicios de terceros (Google, Bing Images, marketplaces, etc.).
- No navega auténticamente ni reutiliza sesiones.
- No usa credenciales, cookies ni tokens.

## Requisitos de instalación

Python 3.8 o superior.

```bash
pip install -r requirements.txt
playwright install chromium  # Instalar navegador Chromium
```

Contenido de `requirements.txt`:

```txt
requests>=2.31.0
beautifulsoup4>=4.12.0
pandas>=2.0.0
openpyxl>=3.1.0
playwright>=1.40.0
```

## Ejemplos de uso

### CSV con columna SKU detectada automáticamente

```bash
python tools/enrich_hikvision_catalog.py \
  --input data/productos.csv \
  --output-dir tools/enrichment_output
```

### XLSX con columna SKU explícita

```bash
python tools/enrich_hikvision_catalog.py \
  --input data/productos.xlsx \
  --sku-column Referencia \
  --output-dir tools/enrichment_output
```

### Modo prueba controlada (dry-run, limite de 3 filas)

```bash
python tools/enrich_hikvision_catalog.py \
  --input data/productos.csv \
  --output-dir tools/enrichment_output \
  --dry-run \
  --limit 3
```

### Retomar ejecución anterior

```bash
python tools/enrich_hikvision_catalog.py \
  --input data/productos.csv \
  --output-dir tools/enrichment_output \
  --resume
```

### Usar mapeo manual de URLs (prioridad sobre búsqueda automática)

```bash
python tools/enrich_hikvision_catalog.py \
  --input data/productos.csv \
  --output-dir tools/enrichment_output \
  --source-map config/mapa_manual.csv
```

## Argumentos CLI

| Argumento             | Tipo     | Requerido | Por defecto | Descripción                                                                 |
|----------------------|----------|-----------|-------------|-----------------------------------------------------------------------------|
| `--input`            | str      | Sí        | —           | Archivo de entrada (.csv o .xlsx)                                           |
| `--output-dir`       | str      | Sí        | —           | Directorio de salida                                                        |
| `--sku-column`       | str      | No        | `None`      | Nombre de la columna SKU (detecta: sku, referencia, modelo, model)         |
| `--max-images`       | int      | No        | `5`         | Máximo imágenes por SKU (1–10)                                              |
| `--delay-seconds`    | float    | No        | `1.5`       | Pausa entre consultas (mínimo 1.0)                                          |
| `--limit`            | int      | No        | `None`      | Limita a primeras `n` filas                                                 |
| `--dry-run`          | flag     | No        | `False`     | No descarga imágenes ni PDFs                                                |
| `--resume`           | flag     | No        | `False`     | Retoma ejecución previa, salta SKUs finalizados                             |
| `--source-map`       | str      | No        | `None`      | Archivo CSV con mapeos `sku,source_url` (prioridad sobre auto-búsqueda)      |
| `--verbose`          | flag     | No        | `False`     | Muestra logs de depuración                                                  |

## Plantilla mínima de archivo de entrada (CSV)

```csv
sku,nombre,categoria
DS-2CD2026G2-IU (D),Cámara de red 4K,Hikvision
,Producto sin SKU,
```

## Formato del mapa manual de URLs

Archivo CSV con columnas:

```csv
sku,source_url
DS-2CD2026G2-IU (D),https://www.hikvision.com/es-co/products/IP-Products/xxx
```

Este mapeo tiene **prioridad** sobre la búsqueda automática.

## Estructura de archivos de salida

```
tools/enrichment_output/
├── catalogo_hikvision_enriquecido.xlsx
├── catalogo_hikvision_enriquecido.csv
├── catalogo_hikvision_especificaciones.json
├── enrichment_log.csv
└── images/
    ├── hikvision__DS-2CD2026G2-IU__01.jpg
    └── hikvision__DS-2CD2026G2-IU__02.jpg
```

## Estados (`match_status`)

| Estado            | Significado                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `matched`        | SKU confirmado exactamente; información técnica completa extraída           |
| `partial`        | SKU confirmado, pero faltan algunos campos o assets                          |
| `ambiguous`      | Múltiples resultados posibles; no se descargan imágenes ni documentos        |
| `not_found`      | SKU no encontrado en Hikvision                                              |
| `invalid_sku`    | SKU vacío o inválido                                                        |
| `error`          | Error durante el procesamiento (HTTP 403, CAPTCHA, bloqueo, etc.)            |

## Reglas de seguridad

- **No** usar cookies, tokens, credenciales ni sesiones de navegador.
- **Únicamente** dominios oficiales permitidos:
  - `www.hikvision.com`
  - `hikvision.com`
  - `display.hikvision.com`
  - `pro-av.hikvision.com`
- Las URLs de redirección o recursos fuera de estos hosts se rechazan automáticamente.
- El `User-Agent` identifica claramente la herramienta:
  `GrupoSecurityCatalogEnricher/1.0 (authorized-catalog-enrichment)`
- Respeta `robots.txt` cuando es consultable.
- No sobrescribe imágenes existentes en disco.
- No persiste datos sensibles en logs ni en el repositorio.
- No extrae ni modifica precios.

## Limitaciones

- **Variantes regionales**: Pueden no estar disponibles en todas las regiones.
- **Productos descontinuados**: Pueden retornar 404 o redirigir a una página genérica.
- **Bloqueos HTTP**: Responderá con estado `error` y continuará con el siguiente SKU.
- **Cambios en HTML**: El parser es tolerante pero sensible a estructuras inesperadas.
- **Datos faltantes**: Si una sección no existe, se retornará vacío o `null`.
- **Estructura de URLs**: Hikvision usa estructuras de URLs dinámicas; el script navega categorías conocidas para encontrar productos.
- **SKUs no encontrados**: Algunos SKUs pueden no tener página individual en el sitio oficial de Hikvision.

## Revisión manual requerida

Los archivos de salida generados (`*.xlsx`, `*.csv`, `*.json`) requieren **revisión humana** antes de cualquier uso posterior (importación, sincronización o carga en sistemas internos). No se garantiza exactitud comercial ni técnica plena.
