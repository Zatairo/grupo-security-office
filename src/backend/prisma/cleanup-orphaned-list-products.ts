/**
 * Limpieza administrativa TEMPORAL de productos y precios huérfanos de Lista.
 *
 * Actúa EXCLUSIVAMENTE sobre registros cuyo `Product.listaId` sea `null` (listas de
 * prueba ya eliminadas) y sobre precios huérfanos (`Price.listaId IS NULL`).
 *
 * Seguridad:
 * - Sin el argumento exacto `--confirm-delete-orphaned-products` NO se ejecuta ninguna
 *   escritura; solo se muestra la previsualización y se termina con código de salida != 0.
 * - Con confirmación, borra en UNA transacción en orden seguro por dependencias.
 * - Conserva AuditLog (historial) y la Lista existente (no crea ni reasigna nada).
 *
 * No imprime secretos (ni DATABASE_URL, ni hashes, ni datos de usuario).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const CONFIRM_FLAG = '--confirm-delete-orphaned-products';

/** Carga DATABASE_URL de .env en process.env sin imprimirlo. */
function loadEnv(): void {
  const candidates = [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')];
  for (const envPath of candidates) {
    if (process.env.DATABASE_URL) return;
    if (!fs.existsSync(envPath)) continue;
    const txt = fs.readFileSync(envPath, 'utf8');
    const m = txt.match(/^DATABASE_URL=(.*)$/m);
    if (m && m[1]) {
      process.env.DATABASE_URL = m[1].trim();
      return;
    }
  }
}

async function verifyAfter(prisma: PrismaClient) {
  const listaIds = (await prisma.lista.findMany({ select: { id: true } })).map((l) => l.id);
  const products = await prisma.product.findMany({ select: { id: true, listaId: true } });
  const precios = await prisma.price.findMany({ select: { id: true, productId: true, listaId: true } });
  const prodId = new Set(products.map((p) => p.id));
  const validProductIds = products.filter((p) => p.listaId !== null && listaIds.includes(p.listaId)).map((p) => p.id);
  const validSet = new Set(validProductIds);
  return {
    productosSinListaRestantes: products.filter((p) => p.listaId === null).length,
    preciosSinListaRestantes: precios.filter((pr) => pr.listaId === null).length,
    productosConListaValidosRestantes: validSet.size,
    preciosDeProductosValidosRestantes: precios.filter((pr) => validSet.has(pr.productId) && pr.listaId !== null).length,
    totalListasRestantes: listaIds.length,
    productosSinSerieProbableProd: precios.filter((pr) => !prodId.has(pr.productId)).length,
  };
}

async function main() {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  loadEnv();

  const prisma = new PrismaClient();

  // ---- Fase 1: previsualización (solo lectura) ----
  const orphanProducts = await prisma.product.findMany({
    where: { listaId: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sku: true, name: true, createdAt: true },
  });
  const ids = orphanProducts.map((p) => p.id);

  const [totalPreciosHuerfanos, totalImagenes, totalStock] = await Promise.all([
    prisma.price.count({
      where: { OR: [{ productId: { in: ids } }, { listaId: null }] },
    }),
    prisma.productImage.count({ where: { productId: { in: ids } } }),
    prisma.stock.count({ where: { productId: { in: ids } } }),
  ]);

  console.log(
    JSON.stringify(
      {
        totalProductosHuerfanos: orphanProducts.length,
        totalPreciosHuerfanos,
        totalImagenesDeProductosHuerfanos: totalImagenes,
        totalStockDeProductosHuerfanos: totalStock,
        ejemplos: orphanProducts.slice(0, 20).map((p) => ({
          sku: p.sku,
          name: p.name,
          createdAt: p.createdAt,
        })),
      },
      null,
      2,
    ),
  );

  // ---- Protección: sin flag exacto no se escribe ----
  if (!confirmed) {
    console.error('\nNo se confirmó la eliminación. Sin el flag no se realiza ninguna escritura.');
    console.error('Para ejecutar el borrado físico confirmado usa exactamente:');
    console.error(`  npx ts-node prisma/cleanup-orphaned-list-products.ts ${CONFIRM_FLAG}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  if (ids.length === 0) {
    console.log('\nSin productos huérfanos; no se ejecuta escritura.');
    console.log(JSON.stringify(await verifyAfter(prisma), null, 2));
    await prisma.$disconnect();
    process.exit(0);
  }

  // ---- Fase 2: eliminación confirmada (una única transacción, orden seguro) ----
  const eliminados = await prisma.$transaction(async (tx) => {
    // 1. IDs de productos con listaId null (ids ya calculado)
    // 2. Imágenes dependientes
    const productImage = await tx.productImage.deleteMany({ where: { productId: { in: ids } } });
    // 3. Precios: huérfanos (listaId null) o de productos huérfanos
    const price = await tx.price.deleteMany({
      where: { OR: [{ productId: { in: ids } }, { listaId: null }] },
    });
    // 4. Stock de esos productos
    const stock = await tx.stock.deleteMany({ where: { productId: { in: ids } } });
    // 5. Assignments PRODUCT de esos productos (representación resourceType/resourceId)
    const assignment = await tx.assignment.deleteMany({
      where: { resourceType: 'PRODUCT', resourceId: { in: ids } },
    });
    // 6. AuditLog se conserva (no se borra): FK opcional → la BD lo deja con productId null
    // 7. Productos huérfanos
    const product = await tx.product.deleteMany({ where: { listaId: null } });

    return {
      productImagesEliminadas: productImage.count,
      preciosEliminados: price.count,
      stocksEliminados: stock.count,
      assignmentsPRODUCTEliminados: assignment.count,
      productosEliminados: product.count,
    };
  });

  console.log('\nEliminación ejecutada en transacción:');
  console.log(JSON.stringify(eliminados, null, 2));

  // ---- Verificación posterior (solo lectura) ----
  console.log('\nVerificación posterior:');
  console.log(JSON.stringify(await verifyAfter(prisma), null, 2));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR', e);
  process.exit(2);
});