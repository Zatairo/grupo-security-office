-- CreateTable
CREATE TABLE "catalogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogs_code_key" ON "catalogs"("code");

-- Backfill: crea el catálogo por defecto si no existe (idempotente)
INSERT INTO "catalogs" ("id", "name", "code", "description", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Catálogo General', 'CAT-DEFAULT', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "catalogs" WHERE "code" = 'CAT-DEFAULT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "catalogId" TEXT;

-- Backfill: asigna todos los productos existentes al catálogo por defecto
UPDATE "products" SET "catalogId" = (SELECT "id" FROM "catalogs" WHERE "code" = 'CAT-DEFAULT') WHERE "catalogId" IS NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "catalogId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "products_catalogId_idx" ON "products"("catalogId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
