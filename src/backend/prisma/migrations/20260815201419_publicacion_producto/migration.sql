-- AlterTable
ALTER TABLE "products" ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "publishStatus" TEXT NOT NULL DEFAULT 'borrador',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "unpublishAt" TIMESTAMP(3),
ADD COLUMN     "unpublishReason" TEXT;

-- CreateIndex
CREATE INDEX "products_publishStatus_idx" ON "products"("publishStatus");

-- CreateIndex
CREATE INDEX "products_publishAt_idx" ON "products"("publishAt");

-- CreateIndex
CREATE INDEX "products_unpublishAt_idx" ON "products"("unpublishAt");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
