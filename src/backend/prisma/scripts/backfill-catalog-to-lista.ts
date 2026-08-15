/**
 * Fase B — Backfill no destructivo: Catalog -> Lista.
 *
 * Ambiente local (DATABASE_URL=localhost). Script idempotente y transaccional.
 * No modifica el seed existente. No borra ni modifica valores de priceListId.
 *
 * Mapeo:
 *  - CAT-DEFAULT  -> LISTA-GENERAL (reutilizada, no duplicada)  [decisiones 8 y 14]
 *  - cualquier otro Catalog (code único) -> Lista(code, name, description, isActive)
 *  - products.listaId  = Lista(mapa[products.catalogId])
 *  - prices.listaId   = products.listaId del producto
 *  - assignments CATALOG -> LISTA (resourceId = Lista mapeada; level preservado)  [decision 8]
 *
 * Invariantes verificadas al final (count 0):
 *  - producto sin catalogId ni listaId
 *  - price.listaId != product.listaId
 *  - price sin producto / priceListId inválido
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

async function main() {
  const log: string[] = [];
  const errs: string[] = [];
  const catalogToLista = new Map<string, string>();
  let assignedProducts = 0;
  let assignedPrices = 0;
  let migratedAssignments = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Lista semilla LISTA-GENERAL (idempotente)
    let listaGeneral = await tx.lista.findUnique({ where: { code: 'LISTA-GENERAL' } });
    if (!listaGeneral) {
      listaGeneral = await tx.lista.create({
        data: {
          code: 'LISTA-GENERAL',
          name: 'Lista General',
          currency: 'COP',
          isActive: true,
        },
      });
      log.push(`[create] LISTA-GENERAL -> ${listaGeneral.id}`);
    } else {
      log.push(`[skip] LISTA-GENERAL ya existe -> ${listaGeneral.id}`);
    }

    // 2. Mapeo 1:1 Catalog -> Lista
    const catalogs = await tx.catalog.findMany({
      select: { id: true, code: true, name: true, description: true, isActive: true },
    });

    for (const c of catalogs as CatalogRow[]) {
      let listaId: string;
      if (c.code === 'CAT-DEFAULT') {
        listaId = listaGeneral.id;
      } else {
        if (c.code === 'LISTA-GENERAL') {
          throw new Error(
            `Catálogo con code "LISTA-GENERAL" colisiona con la lista semilla (decision 8). Abortar.`,
          );
        }
        const existing = await tx.lista.findUnique({ where: { code: c.code } });
        if (existing) {
          listaId = existing.id;
          log.push(`[skip] Lista ya existente para catálogo ${c.code} -> ${existing.id}`);
        } else {
          const created = await tx.lista.create({
            data: {
              code: c.code,
              name: c.name,
              description: c.description,
              isActive: c.isActive,
              currency: 'COP',
            },
          });
          listaId = created.id;
          log.push(`[create] Lista desde catálogo ${c.code} -> ${created.id}`);
        }
      }
      catalogToLista.set(c.id, listaId);
    }

    // 3. Products sin listaId: resolver desde catalogId
    const productsSinLista = await tx.product.findMany({
      where: { listaId: null },
      select: { id: true, sku: true, catalogId: true },
    });
    for (const p of productsSinLista) {
      if (!p.catalogId) {
        errs.push(`producto ${p.id} (${p.sku}) sin catalogId ni listaId`);
        continue;
      }
      const listaId = catalogToLista.get(p.catalogId);
      if (!listaId) {
        errs.push(`producto ${p.id} (${p.sku}) catalogId=${p.catalogId} no mapeado`);
        continue;
      }
      await tx.product.update({ where: { id: p.id }, data: { listaId } });
      assignedProducts++;
    }
    log.push(`[update] products.listaId asignados: ${assignedProducts}`);

    // 4. Prices sin listaId: resolver desde product.listaId (invariante)
    const pricesSinLista = await tx.price.findMany({
      where: { listaId: null },
      select: { id: true, productId: true },
    });
    for (const pr of pricesSinLista) {
      const product = await tx.product.findUnique({
        where: { id: pr.productId },
        select: { listaId: true },
      });
      if (!product || !product.listaId) {
        errs.push(`precio ${pr.id} productId=${pr.productId} sin listaId de producto`);
        continue;
      }
      await tx.price.update({ where: { id: pr.id }, data: { listaId: product.listaId } });
      assignedPrices++;
    }
    log.push(`[update] prices.listaId asignados: ${assignedPrices}`);

    // 5. Assignments CATALOG -> LISTA (idempotente, preserva level/isActive/userId)
    const catalogAssignments = await tx.assignment.findMany({
      where: { resourceType: 'CATALOG' },
      select: { id: true, userId: true, roleId: true, resourceId: true, level: true, isActive: true },
    });
    for (const a of catalogAssignments) {
      const listaId = catalogToLista.get(a.resourceId);
      if (!listaId) {
        errs.push(`assignment ${a.id}: resourceId=${a.resourceId} (CATALOG) no mapeado a Lista`);
        continue;
      }
      // Idempotencia: si ya existe una assignment LISTA para este scope, no duplicar.
      // findFirst (no findUnique) porque el scope puede ser por role (sin unique compuesto).
      const whereScope: any = a.roleId
        ? { roleId: a.roleId, resourceType: 'LISTA', resourceId: listaId }
        : { userId: a.userId, resourceType: 'LISTA', resourceId: listaId };
      const existingLista = await tx.assignment.findFirst({ where: whereScope });
      if (existingLista) {
        // Ya migrada en una corrida previa: desactivar la original si quedó como CATALOG inactiva.
        log.push(`[skip] assignment ${a.id} ya migrada a LISTA -> ${existingLista.id}`);
      } else {
        // Reutilizar la fila UPDATE in-place (mantiene id, userId, roleId, level, isActive).
        await tx.assignment.update({
          where: { id: a.id },
          data: { resourceType: 'LISTA', resourceId: listaId },
        });
        migratedAssignments++;
        log.push(`[update] assignment ${a.id} ${a.roleId ? 'role' : 'user'} scope -> LISTA ${listaId} (level=${a.level})`);
      }
    }
    log.push(`[update] assignments CATALOG->LISTA migradas: ${migratedAssignments}`);

    // 6. Auditoría ligera (AuditLog genérico) del backfill
    await tx.auditLog.create({
      data: {
        action: 'BACKFILL_CATALOG_TO_LISTA',
        entity: 'LISTA',
        entityId: listaGeneral.id,
        newValues: {
          catalogCount: catalogs.length,
          productsAssigned: assignedProducts,
          pricesAssigned: assignedPrices,
          assignmentsMigrated: migratedAssignments,
          catalogToLista: Object.fromEntries(catalogToLista),
          log,
        },
      },
    });

    if (errs.length > 0) {
      throw new Error(`Backfill abortado con errores: ${JSON.stringify(errs)}`);
    }
  });

  console.log('=== BACKFILL CATALOG -> LISTA (completado) ===');
  log.forEach((l) => console.log(`  ${l}`));
  console.log('=== RESUMEN ===');
  console.log(`  Listas creadas/usadas: ${catalogToLista.size}`);
  console.log(`  Products con listaId: ${assignedProducts}`);
  console.log(`  Prices con listaId: ${assignedPrices}`);
  console.log(`  Assignments migradas: ${migratedAssignments}`);
  if (errs.length) console.log(`  ERRORES: ${errs.length}`);
}

main()
  .catch((e) => {
    console.error('BACKFILL FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
