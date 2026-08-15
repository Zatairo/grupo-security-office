-- Fase A — Esquema no destructivo: entidad Lista como raíz de Producto.
--
-- Principios:
--   * No se borra ninguna tabla (Catalog, PriceList, products, prices, assignments se conservan).
--   * No se borra/modifica ninguna columna ni fila existente.
--   * No se realiza backfill de datos (productos, precios, catálogos, asignaciones).
--   * No se crea LISTA-GENERAL (corresponde a Fase B: seed + backfill).
-- Ver .kilo/context/diseno-tecnico-lista-raiz.md §5 Fase A.

---------------------------------------------------------------------
-- 1. Tabla `listas` (nueva entidad raíz)
---------------------------------------------------------------------
CREATE TABLE "listas" (
    "id"         TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "description" TEXT,
    "currency"   TEXT NOT NULL DEFAULT 'COP',
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "listas_code_key" ON "listas"("code");
CREATE INDEX "listas_isActive_idx" ON "listas"("isActive");
CREATE INDEX "listas_archivedAt_idx" ON "listas"("archivedAt");

-- FKs opcionales de creador/actualizador (usuario). onDelete SET NULL para que
-- al inactivar/borrar un usuario no se rompa la Lista.
ALTER TABLE "listas"
    ADD CONSTRAINT "listas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "listas_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

---------------------------------------------------------------------
-- 2. products.listaId (nullable) → listas. Fuente de verdad transitoria.
---------------------------------------------------------------------
ALTER TABLE "products" ADD COLUMN "listaId" TEXT;
ALTER TABLE "products"
    ADD CONSTRAINT "products_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "listas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "products_listaId_idx" ON "products"("listaId");

---------------------------------------------------------------------
-- 3. prices.listaId (nullable) → listas. Fuente de verdad transitoria.
---------------------------------------------------------------------
ALTER TABLE "prices" ADD COLUMN "listaId" TEXT;
ALTER TABLE "prices"
    ADD CONSTRAINT "prices_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "listas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "prices_listaId_idx" ON "prices"("listaId");

---------------------------------------------------------------------
-- 4. assignments.roleId (nullable) → roles. Permite assignments por Rol.
---------------------------------------------------------------------
ALTER TABLE "assignments" ADD COLUMN "roleId" TEXT;
ALTER TABLE "assignments"
    ADD CONSTRAINT "assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "assignments_roleId_idx" ON "assignments"("roleId");

---------------------------------------------------------------------
-- 5. Restricciones FUTURAS (NO aplicadas en esta fase para no bloquear datos).
--    Se registran como comentarios y se implementarán en Fase A2/B tras validación.
---------------------------------------------------------------------

-- 5a. resourceType permitido. Hoy es string libre validado por app (ASSIGNMENT_RESOURCE_TYPES).
--     Futuro (Fase A2): CHECK estricto. No se aplica ahora para evitar invalidar si
--     se retrasa la inclusión de LISTA en la app.
COMMENT ON COLUMN "assignments"."resourceType" IS 'ResourceType: CATALOG, PRICE_LIST, CATEGORY (legado) y LISTA (futuro). Validado por app (create-assignment.dto.ts). Futuro CHECK IN (...) en Fase A2.';

-- 5b. XOR userId / roleId (decision 6). userId sigue NOT NULL en esta fase;
--     el CHECK exige exactamente uno poblado, pero como userId es obligatorio hoy,
--     toda fila cumple (userId set, roleId NULL). El CHECK real se agrega en Fase A2
--     junto con la conversión de userId a nullable.
COMMENT ON TABLE "assignments" IS 'Fase A2: (1) userId → nullable; (2) ADD CHECK ((userId IS NULL) <> (roleId IS NULL)); (3) reemplazar @@unique(userId,resourceType,resourceId) por idxs parciales: CREATE UNIQUE INDEX assignments_user_unique ON assignments(resourceType,resourceId,userId) WHERE userId IS NOT NULL AND roleId IS NULL; CREATE UNIQUE INDEX assignments_role_unique ON assignments(resourceType,resourceId,roleId) WHERE roleId IS NOT NULL AND userId IS NULL. En Fase A se conserva la @@unique actual.';

-- 5c. Invariante Price.listaId = Product.listaId (decision 6). Validación en app (PricesService).
--     Se considera un trigger CHECK en una fase posterior.
COMMENT ON COLUMN "prices"."listaId" IS 'Invariante: prices.listaId debe igualar products.listaId del producto (Price.listaId == Product.listaId). Validado en PricesService. Trigger CHECK diferido.';

-- 5d. Consistencia Product.listaId vs Catalog. Durante la transición, el servicio
--     validará que el Producto pertenece a la Lista correcta.
COMMENT ON COLUMN "products"."listaId" IS 'Fuente de verdad (transición). Invariante con Product.listaId == Product.catalog (hasta fase D). resolverListaId en ProductsService.';
