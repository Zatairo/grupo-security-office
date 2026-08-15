-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_catalogId_fkey";

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "catalogId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
