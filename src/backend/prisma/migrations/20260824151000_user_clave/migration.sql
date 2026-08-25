-- Migración: clave por usuario (password en User)
-- Propósito: almacenar hash bcrypt de la clave personal que el usuario
-- configura desde el apartado Usuarios. Es NULLABLE: NULL = sin clave configurada
-- (el sistema NO la pide). Nunca se expone el hash en las respuestas.
ALTER TABLE "users" ADD COLUMN "password" TEXT;
