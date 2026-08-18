-- AlterTable
ALTER TABLE "listas" ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "listas_codigo_key" ON "listas"("codigo");

-- CreateIndex
CREATE INDEX "listas_supplierId_idx" ON "listas"("supplierId");

-- AddForeignKey
ALTER TABLE "listas" ADD CONSTRAINT "listas_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;