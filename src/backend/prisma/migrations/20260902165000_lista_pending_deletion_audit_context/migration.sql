-- Migración aditiva: eliminación diferida de Lista y contexto de auditoría.
--
-- Principios:
--   * Solo agrega columnas, una FK y un índice nuevos; no borra ni modifica nada existente.
--   * No incluye DROP / TRUNCATE / DELETE / CASCADE destructivo ni actualizaciones de datos.
--   * Los nombres físicos usan la convención Prisma del proyecto (columnas camelCase sin @map,
--     tabla @@map, índices "tabla_campo_idx", FK "tabla_campo_fkey").
--   * Alineado con schema.prisma (campos de Lista y AuditLog.result).
--
-- Rollback manual (NO se ejecuta; solo referencia):
--   ALTER TABLE "audit_logs" DROP COLUMN "result";
--   DROP INDEX IF EXISTS "listas_deletionPurgeAt_idx";
--   ALTER TABLE "listas" DROP CONSTRAINT IF EXISTS "listas_deletionRequestedById_fkey";
--   ALTER TABLE "listas" DROP COLUMN IF EXISTS "deletionRequestedById";
--   ALTER TABLE "listas" DROP COLUMN IF EXISTS "deletionReason";
--   ALTER TABLE "listas" DROP COLUMN IF EXISTS "deletionPurgeAt";
--   ALTER TABLE "listas" DROP COLUMN IF EXISTS "deletionRequestedAt";
--   ALTER TABLE "listas" DROP COLUMN IF EXISTS "deletionStatus";

---------------------------------------------------------------------
-- 1. `listas`: campos de eliminación diferida (nullable, sin defaults)
---------------------------------------------------------------------
ALTER TABLE "listas" ADD COLUMN "deletionStatus" TEXT;
ALTER TABLE "listas" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "listas" ADD COLUMN "deletionPurgeAt" TIMESTAMP(3);
ALTER TABLE "listas" ADD COLUMN "deletionReason" TEXT;
ALTER TABLE "listas" ADD COLUMN "deletionRequestedById" TEXT;

-- FK opcional hacia el usuario solicitante (relación ListaDeletionRequester),
-- onDelete SET NULL para no romper la Lista si el usuario se inactiva/elimina.
ALTER TABLE "listas"
    ADD CONSTRAINT "listas_deletionRequestedById_fkey"
    FOREIGN KEY ("deletionRequestedById")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice para el scheduler de purga de Listas vencidas.
CREATE INDEX "listas_deletionPurgeAt_idx" ON "listas"("deletionPurgeAt");

---------------------------------------------------------------------
-- 2. `audit_logs`: contexto de resultado ('SUCCESS' | 'ERROR' | 'WARNING')
---------------------------------------------------------------------
ALTER TABLE "audit_logs" ADD COLUMN "result" TEXT;