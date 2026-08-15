/*
  Warnings:

  - You are about to drop the column `catalogId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `catalogs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_catalogId_fkey";

-- DropIndex
DROP INDEX "products_catalogId_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "catalogId";

-- DropTable
DROP TABLE "catalogs";
