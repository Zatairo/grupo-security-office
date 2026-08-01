/**
 * Generador de slugs para entidades del catálogo.
 *
 * A diferencia del simple generateSlug en text-normalizer.ts,
 * este módulo genera slugs con lógica de negocio:
 * - Verifica unicidad en base de datos
 * - Maneja colisiones con sufijos numéricos
 * - Soporta jerarquías (categorías padre/hijo)
 */

import { PrismaService } from '../../../../prisma/prisma.service';
import { generateSlug as baseGenerateSlug } from './text-normalizer';

/**
 * Genera un slug único para una categoría.
 * Si el slug ya existe, agrega un sufijo numérico: "cctv" → "cctv-2"
 */
export async function generateUniqueCategorySlug(
  prisma: PrismaService,
  name: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = baseGenerateSlug(name);
  if (!baseSlug) return `sin-nombre-${Date.now()}`;

  const existing = await prisma.category.findUnique({
    where: { slug: baseSlug },
  });

  if (!existing || existing.id === excludeId) return baseSlug;

  // Buscar el siguiente sufijo disponible
  let counter = 2;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const candidate = await prisma.category.findUnique({
      where: { slug: candidateSlug },
    });

    if (!candidate || candidate.id === excludeId) return candidateSlug;
    counter++;
  }
}

/**
 * Genera un slug único para una marca.
 * Si el slug ya existe, agrega un sufijo numérico.
 */
export async function generateUniqueBrandSlug(
  prisma: PrismaService,
  name: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = baseGenerateSlug(name);
  if (!baseSlug) return `sin-nombre-${Date.now()}`;

  const existing = await prisma.brand.findUnique({
    where: { slug: baseSlug },
  });

  if (!existing || existing.id === excludeId) return baseSlug;

  let counter = 2;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const candidate = await prisma.brand.findUnique({
      where: { slug: candidateSlug },
    });

    if (!candidate || candidate.id === excludeId) return candidateSlug;
    counter++;
  }
}
