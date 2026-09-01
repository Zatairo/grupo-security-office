/*
  Warnings:

  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('PORTADA', 'LOGO', 'PRINCIPAL', 'COMPLEMENTARIA', 'EXTRA');

-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "type" "ProductImageType" NOT NULL DEFAULT 'PRINCIPAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT NOT NULL;

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes with gin_trgm_ops for fuzzy search on Product
CREATE INDEX "product_name_gin" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX "product_sku_gin" ON "products" USING gin ("sku" gin_trgm_ops);
CREATE INDEX "product_desc_gin" ON "products" USING gin ("description" gin_trgm_ops);
