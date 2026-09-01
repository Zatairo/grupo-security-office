-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes on products table for full-text search using pg_trgm
CREATE INDEX IF NOT EXISTS product_name_gin ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_sku_gin ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_desc_gin ON products USING gin (description gin_trgm_ops);