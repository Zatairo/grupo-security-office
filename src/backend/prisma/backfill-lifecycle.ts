import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORDER = ['DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'DISCONTINUED', 'ARCHIVED'];

interface ProductRow {
  id: string;
  isActive: boolean;
  isVisible: boolean;
  publishStatus: string | null;
  publishAt: Date | null;
  unpublishAt: Date | null;
  lifecycleStatus: string;
}

function computeLifecycle(p: ProductRow): string {
  const status = p.publishStatus ?? '';
  if (status === 'archivado') return 'ARCHIVED';
  if (status === 'publicado') {
    return p.isActive ? (p.isVisible ? 'PUBLISHED' : 'HIDDEN') : 'DISCONTINUED';
  }
  if (status === 'listo' || status === 'programado') {
    return p.publishAt ? 'SCHEDULED' : 'READY';
  }
  if (!p.isActive) return 'DISCONTINUED';
  return 'DRAFT';
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      isActive: true,
      isVisible: true,
      publishStatus: true,
      publishAt: true,
      unpublishAt: true,
      lifecycleStatus: true,
    },
    orderBy: { id: 'asc' },
  });

  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  for (const s of ORDER) {
    before[s] = 0;
    after[s] = 0;
  }

  let updated = 0;
  const audits = [];

  for (const p of products) {
    const current = p.lifecycleStatus ?? 'DRAFT';
    before[current] = (before[current] ?? 0) + 1;

    const target = computeLifecycle(p);
    after[target] = (after[target] ?? 0) + 1;

    if (current !== target) {
      await prisma.product.update({
        where: { id: p.id },
        data: { lifecycleStatus: target },
      });
      updated++;
      audits.push({
        action: 'backfill',
        entity: 'Product',
        entityId: p.id,
        productId: p.id,
        userId: null,
        oldValues: {
          isActive: p.isActive,
          isVisible: p.isVisible,
          publishStatus: p.publishStatus,
          publishAt: p.publishAt,
          unpublishAt: p.unpublishAt,
        },
        newValues: { lifecycleStatus: target },
      });
    }
  }

  if (audits.length > 0) {
    await prisma.auditLog.createMany({ data: audits });
  }

  console.log('=== RESUMEN BACKFILL LIFECYCLE ===');
  console.log(`Productos totales: ${products.length}`);
  console.log('Estado\tAntes\tDespues');
  for (const s of ORDER) {
    console.log(`${s}\t${before[s] ?? 0}\t${after[s] ?? 0}`);
  }
  console.log(`Filas actualizadas: ${updated}`);
  console.log(`Audits creados: ${audits.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());