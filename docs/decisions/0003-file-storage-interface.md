# ADR 0003: Archivos — Interfaz Abstracta StorageBackend

**Fecha**: 2026-09-01
**Estado**: Aprobado
**Decisores**: Usuario, finance-orchestrator, solution-architect, backend-engineer, devops-release-engineer

## Contexto

El sistema necesita almacenar adjuntos (comprobantes, imágenes OCR). Opciones evaluadas:

1. **LocalFS directo** — Simple, pero no portable a producción, testing difícil
2. **MinIO (S3-compatible) local + S3 prod** — API consistente, pero servicio extra en docker-compose
3. **Interfaz abstracta `StorageBackend` + 2 implementaciones (LocalFS, S3Compatible)** — Testable, portable, cero deps en test

## Decisión

**Definir una interfaz abstracta de almacenamiento:**
- `LocalFS` para desarrollo y tests
- Implementación compatible con S3 (MinIO local / AWS S3 / Cloudflare R2) para producción
- La base de datos almacena **metadatos y referencias**, no archivos binarios
- **Ningún archivo debe quedar públicamente accesible** (URLs firmadas con expiración, o proxy autenticado)
- Validar: MIME type, extensión, tamaño máximo, hash (SHA-256) para deduplicación e integridad

## Justificación

- **Testabilidad**: Tests unitarios usan `LocalStorage` en `tmp/` sin MinIO. Tests de integración pueden usar MinIO opcional.
- **Portabilidad**: Cambio de proveedor (S3 → R2 → MinIO) solo requiere nueva implementación de `StorageBackend`.
- **Seguridad**: Archivos nunca públicos. Acceso via endpoint autenticado que valida ownership y genera signed URL corta (5-15 min) o sirve via proxy autenticado (nginx `X-Accel-Redirect`).
- **Integridad**: Hash SHA-256 en BD permite detectar corrupción y deduplicar subidas idénticas.
- **Cumplimiento**: Metadatos en BD (filename, mime, size, hash, owner, transaction_id) facilitan auditoría y GDPR/retención.

## Interfaz `StorageBackend` (Protocol)

```python
from typing import Protocol, BinaryIO
from dataclasses import dataclass

@dataclass
class UploadResult:
    key: str           # ruta interna única (ej. "user-123/txn-456/uuid.pdf")
    size: int
    sha256: str
    mime_type: str

@dataclass
class FileMetadata:
    key: str
    size: int
    sha256: str
    mime_type: str
    created_at: datetime

class StorageBackend(Protocol):
    async def upload(self, key: str, file: BinaryIO, mime_type: str) -> UploadResult: ...
    async def download(self, key: str) -> BinaryIO: ...
    async def delete(self, key: str) -> bool: ...
    async def exists(self, key: str) -> bool: ...
    async def get_metadata(self, key: str) -> FileMetadata: ...
    async def generate_presigned_url(self, key: str, expires_in: int = 900) -> str: ...
```

## Implementaciones

| Implementación | Uso | Configuración |
|----------------|-----|---------------|
| `LocalStorage` | Dev, tests unitarios | `STORAGE_LOCAL_ROOT=/tmp/finanzas-uploads` |
| `S3CompatibleStorage` | Staging, Prod, tests integración | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` |

Inyección via FastAPI `Depends(get_storage_backend)` usando `pydantic-settings`.

## Consecuencias

- BD: Tabla `attachments` con `key`, `filename`, `mime_type`, `size`, `sha256`, `owner_id`, `transaction_id`, `created_at`
- Endpoint `POST /attachments` → valida MIME/tamaño → `storage.upload()` → guarda metadatos → retorna `attachment_id`
- Endpoint `GET /attachments/:id` → valida ownership → `storage.generate_presigned_url()` → redirect 302 o JSON con URL
- Cleanup job: adjuntos huérfanos (sin transaction_id > 24h) → `storage.delete()`

## Seguimiento

- Crear `src/backend/storage/` con protocol e implementaciones
- Tests: `LocalStorage` roundtrip, hash verification, presigned URL (mock S3)
- Documentar validación MIME permitidas (image/*, application/pdf, max 10MB)