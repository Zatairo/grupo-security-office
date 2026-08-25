-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lifecycleStatus" TEXT NOT NULL DEFAULT 'DRAFT';

-- Lifecycle CHECK constraint
ALTER TABLE "products" ADD CONSTRAINT "products_lifecycleStatus_check" CHECK ("lifecycleStatus" IN ('DRAFT','READY','SCHEDULED','PUBLISHED','HIDDEN','DISCONTINUED','ARCHIVED'));

-- CreateIndex
CREATE INDEX "products_lifecycleStatus_idx" ON "products"("lifecycleStatus");
