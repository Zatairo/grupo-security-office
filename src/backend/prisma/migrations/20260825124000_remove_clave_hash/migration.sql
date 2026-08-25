-- Drop password from users (clave por usuario eliminada)
ALTER TABLE users DROP COLUMN IF EXISTS password;
