-- Drop claveHash from users (clave por usuario eliminada)
ALTER TABLE users DROP COLUMN IF EXISTS clave_hash;
