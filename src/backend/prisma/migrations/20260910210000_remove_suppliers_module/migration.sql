-- DropForeignKey
ALTER TABLE "listas" DROP CONSTRAINT "listas_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "supplier_evaluations" DROP CONSTRAINT "supplier_evaluations_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "supplier_evaluations" DROP CONSTRAINT "supplier_evaluations_evaluatedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_requestedById_fkey";

-- DropIndex
DROP INDEX "listas_supplierId_idx";

-- AlterTable
ALTER TABLE "listas" DROP COLUMN "supplierId";

-- DropTable
DROP TABLE "suppliers";

-- DropTable
DROP TABLE "supplier_evaluations";

-- DropTable
DROP TABLE "purchase_orders";

