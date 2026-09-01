CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "product_name_gin" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX "product_sku_gin" ON "products" USING gin ("sku" gin_trgm_ops);
CREATE INDEX "product_desc_gin" ON "products" USING gin ("description" gin_trgm_ops);