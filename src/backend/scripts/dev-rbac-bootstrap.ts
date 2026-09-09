#!/usr/bin/env node
/**
 * Dev-only RBAC bootstrap command for Neon DEV.
 *
 * Scope: writes ONLY to the `roles` and `role_permissions` tables. It never touches
 * users, user_roles, catalog, listas, prices, inventory, audit, suppliers, purchase
 * orders, or any legacy seed/migration logic.
 *
 * This script is intentionally safe-by-default. It will not connect to the database
 * unless both of the following guards pass:
 *   1. NODE_ENV === "development" (any other value causes immediate exit, non-zero)
 *   2. User provides exact confirmation "YES" (any other input exits cleanly, no DB)
 *
 * If all guards pass, the script will, per role in the canonical matrix below:
 *   - Resolve the role by exact name (findUnique)
 *   - If it does not exist: create it with its description, then insert its full
 *     permission set (fresh rows only — no deleteMany, no update of existing rows)
 *   - If it already exists: insert ONLY the permissions from the matrix that are
 *     missing (additive, idempotent). Existing permissions are never removed or
 *     modified. The role's description is left untouched to avoid overwriting a
 *     value that may have been set by another process.
 *   - Report (log only) any permission present on the role but absent from the
 *     matrix, without removing it.
 *   - Always disconnect Prisma in a finally block.
 *
 * Explicitly prohibited by design: delete, deleteMany, raw SQL, legacy role
 * migration, global seed invocation, user creation/update.
 *
 * The canonical permission matrix below is copied verbatim from prisma/seed.ts
 * (source of truth). If seed.ts changes, this matrix must be re-synced manually —
 * it is not imported from seed.ts to avoid ever triggering seed.ts's side effects.
 *
 * This script must NOT be run with confirmation "YES" against production or any
 * database whose current role/permission state is not already understood.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

// Canonical permission matrix — verbatim copy from prisma/seed.ts (2026-09-08).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': [
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
    'users:read', 'users:write', 'users:manage',
    'audit:read',
    'listas:create', 'listas:update', 'listas:duplicate', 'listas:import',
    'listas:archive', 'listas:delete', 'listas:publish',
    'products:publish',
    'assignments:manage',
    'publish:manage',
  ],
  'Supervisor': [
    'products:read',
    'audit:read',
    'listas:publish',
    'products:publish',
    'publish:manage',
  ],
  'Admin Comercial': [
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
    'users:read',
    'audit:read',
    'listas:create', 'listas:update', 'listas:duplicate', 'listas:import',
    'listas:archive', 'listas:delete', 'listas:publish',
    'products:publish',
    'assignments:manage',
    'publish:manage',
  ],
  'Operador': [
    'products:read',
    'categories:read',
    'brands:read',
    'prices:read',
  ],
  'Consulta': [
    'products:read',
    'categories:read',
    'brands:read',
    'prices:read',
  ],
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Super Admin': 'Acceso total al sistema y gestión de usuarios y auditoría',
  'Supervisor': 'Supervisión comercial, publicación de productos y auditoría',
  'Admin Comercial': 'Gestión comercial del catálogo, precios, publicación, acceso a usuarios (solo lectura) y auditoría comercial',
  'Operador': 'Consulta del catálogo y precios',
  'Consulta': 'Solo lectura de catálogo y precios',
};

const CANONICAL_ROLE_NAMES = Object.keys(ROLE_PERMISSIONS);

// --- Guard 1: NODE_ENV ---
if (process.env.NODE_ENV !== 'development') {
  console.error(
    'Error: This script is DEV-only. Set NODE_ENV="development" to proceed.'
  );
  process.exit(1);
}

// --- Guard 2: Interactive confirmation ---
async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmed = await new Promise<boolean>((resolve) => {
    rl.question(
      `DEV-only command: This will create/update rows ONLY in "roles" and ` +
        `"role_permissions" for: ${CANONICAL_ROLE_NAMES.join(', ')}. ` +
        `No user, catalog, or legacy data will be touched. Proceed? YES to confirm: `,
      (answer: string) => {
        if (answer === 'YES') {
          resolve(true);
        } else {
          console.log('Confirmation denied. Exiting without DB mutation.');
          resolve(false);
        }
        rl.close();
      }
    );
  });

  if (!confirmed) {
    process.exit(0);
  }

  // --- All guards passed, proceed with database operations ---
  const prisma = new PrismaClient();

  try {
    for (const roleName of CANONICAL_ROLE_NAMES) {
      const matrixPermissions = ROLE_PERMISSIONS[roleName];
      const existingRole = await prisma.role.findUnique({
        where: { name: roleName },
        include: { permissions: true },
      });

      if (!existingRole) {
        // Fresh role: create it, then insert its full permission set (no prior
        // rows exist, so this is a pure insert — not a sync/overwrite).
        const createdRole = await prisma.role.create({
          data: { name: roleName, description: ROLE_DESCRIPTIONS[roleName] },
        });
        await prisma.rolePermission.createMany({
          data: matrixPermissions.map((permission) => ({
            roleId: createdRole.id,
            permission,
          })),
        });
        console.log(
          `[created] Role "${roleName}": ${matrixPermissions.length} permissions inserted.`
        );
        continue;
      }

      // Existing role: add only the permissions missing from the matrix.
      // Never delete or modify existing rows; never touch description.
      const existingPermissionNames = new Set(
        existingRole.permissions.map((p) => p.permission)
      );
      const missing = matrixPermissions.filter(
        (permission) => !existingPermissionNames.has(permission)
      );
      const extra = [...existingPermissionNames].filter(
        (permission) => !matrixPermissions.includes(permission)
      );

      if (missing.length > 0) {
        await prisma.rolePermission.createMany({
          data: missing.map((permission) => ({
            roleId: existingRole.id,
            permission,
          })),
        });
      }

      console.log(
        `[verified] Role "${roleName}" already existed: ${missing.length} permissions added, ` +
          `${existingPermissionNames.size - extra.length} already present.`
      );
      if (extra.length > 0) {
        console.log(
          `[warning] Role "${roleName}" has ${extra.length} permission(s) not in the canonical ` +
            `matrix (left untouched, not removed): ${extra.join(', ')}`
        );
      }
    }

    console.log('RBAC bootstrap completed successfully.');
  } catch (error) {
    console.error('Error during RBAC bootstrap:', error);
    process.exit(1);
  } finally {
    // Always disconnect Prisma in a finally block after instantiation.
    await prisma.$disconnect();
  }
}

// Run the main async function (no top-level await).
main().catch((error) => {
  console.error('Fatal error during RBAC bootstrap:', error);
  process.exit(1);
});
