# ADR 0004: Identificadores — UUIDv7 como PK Interno

**Fecha**: 2026-09-01
**Estado**: Aprobado
**Decisores**: Usuario, finance-orchestrator, solution-architect, data-migration-engineer, backend-engineer

## Contexto

Se requiere estrategia de identificadores para entidades del dominio financiero. Opciones evaluadas:

1. **UUID v4 (random)** — Estándar, nativo en PG, pero no ordenados → fragmentación índices, poor locality
2. **ULID** — Ordenados por timestamp, 16 bytes, URL-safe, pero librería extra, menos nativo en PG
3. **UUID v7 (timestamp + random)** — Ordenados por tiempo, 16 bytes, nativo tipo `uuid` en PG, estándar IETF (draft)
4. **nanoid** — Corto (21 chars), URL-safe, pero no ordenados, colisión posible, no nativo BD
5. **Bigserial / Identity** — Simple, ordenados, pero predecibles, fugan info de volumen, no distribuidos

## Decisión

**Usar UUIDv7 como identificador interno (Primary Key) cuando PostgreSQL y la librería seleccionada lo soporten correctamente.**
- Usar el tipo nativo `uuid` de PostgreSQL (`gen_random_uuid()` para v4, función custom o extensión para v7)
- **Mantener por separado los identificadores externos** provenientes de Excel, WhatsApp y otros sistemas
- **No usar el ID externo como clave primaria** (columna separada `external_id` con `UNIQUE` donde aplique)

## Justificación

- **Orden temporal**: UUIDv7 incluye timestamp Unix (ms) en los primeros 48 bits → inserts ordenados → mejor cluster index, menos fragmentación, range queries eficientes por tiempo.
- **Nativo en PG**: Tipo `uuid` (16 bytes) es nativo, índices eficientes, funciones built-in. Extensión `uuid-ossp` o `pgcrypto` proveen generación; para v7 se puede usar función SQL o librería cliente (ej. `uuid7` en Python, `uuid` en Node).
- **Distribuido**: Generable en cliente (frontend, workers, migración) sin coordinación central.
- **Separación externos**: IDs de Excel (`row_id`), WhatsApp (`message_id`), OCR (`job_id`) son inestables, pueden duplicarse, cambiar de formato, o venir de sistemas ajenos. Mantenerlos en columna `external_id` + `external_source` con `UNIQUE (external_source, external_id)` permite trazabilidad sin comprometer PK.

## Implementación

### PostgreSQL

```sql
-- Extensión para UUIDv7 (opcional, o función SQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- Función UUIDv7 (simplificada, usar librería cliente en app)
CREATE OR REPLACE FUNCTION gen_uuidv7() RETURNS uuid AS $$
  SELECT uuid_generate_v7(); -- requiere extensión uuid-ossp v1.1+ o implementación custom
$$ LANGUAGE sql VOLATILE;

-- Ejemplo tabla
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_uuidv7(),
    external_source varchar(50),       -- 'excel', 'whatsapp', 'manual', 'ocr'
    external_id varchar(255),          -- ID original del sistema fuente
    UNIQUE (external_source, external_id)
);
```

### Python (SQLAlchemy + Pydantic)

```python
# src/backend/models/mixins.py
import uuid
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

def generate_uuidv7() -> uuid.UUID:
    # Usar librería uuid7 o implementación timestamp+random
    from uuid7 import uuid7
    return uuid7()

class UUIDv7Mixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=generate_uuidv7,
        comment="UUIDv7 internal primary key"
    )
    external_source: Mapped[str | None] = mapped_column(
        nullable=True, index=True, comment="Source system: excel, whatsapp, manual, ocr"
    )
    external_id: Mapped[str | None] = mapped_column(
        nullable=True, index=True, comment="Original ID from source system"
    )
```

### Pydantic Schemas

```python
# src/backend/schemas/common.py
from pydantic import BaseModel, Field
from uuid import UUID

class EntityBase(BaseModel):
    id: UUID = Field(..., description="Internal UUIDv7")
    external_source: str | None = None
    external_id: str | None = None
```

## Consecuencias

- Todas las tablas de dominio usan `id uuid PK DEFAULT gen_uuidv7()`
- Migración Excel: `external_source='excel'`, `external_id=row_number_or_hash`
- Ingesta WhatsApp: `external_source='whatsapp'`, `external_id=message_id`
- Ingesta OCR: `external_source='ocr'`, `external_id=job_id`
- Queries por tiempo: `WHERE id >= uuidv7_from_timestamp(start) AND id < uuidv7_from_timestamp(end)` (función helper)
- **No exponer IDs internos en URLs públicas sin autorización** (usar `external_id` donde sea seguro, o tokens firmados)

## Seguimiento

- Verificar soporte UUIDv7 en librerías: `uuid7` (Python), `uuid` v9+ (Node), `pgcrypto`/`uuid-ossp` (PG)
- Si no hay soporte nativo v7 en PG versión usada → fallback a UUID v4 + columna `created_at` indexada para orden temporal
- Documentar en guía de contribución: "Siempre usar `id` (UUIDv7) para FKs y joins. `external_id` solo para trazabilidad."