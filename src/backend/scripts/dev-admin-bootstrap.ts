#!/usr/bin/env node
/**
 * Dev-only admin bootstrap / reset command for Neon DEV.
 *
 * This script is intentionally safe-by-default. It will not connect to the database
 * unless all of the following guards pass:
 *   1. NODE_ENV === "development" (any other value causes immediate exit, non-zero)
 *   2. SEED_ADMIN_PASSWORD is set and non-empty (otherwise immediate exit, non-zero)
 *   3. User provides exact confirmation "YES" (any other input exits cleanly, no DB)
 *
 * If all guards pass, the script will:
 *   - Resolve the existing "Super Admin" role by exact name (no role creation/update/deletion)
 *   - Hash SEED_ADMIN_PASSWORD using bcrypt with salt round 12 (repo convention from seed.ts)
 *   - Upsert the single declared admin user by the existing email contract
 *   - Assign the Super Admin role via the user-role relationship
 *   - Always disconnect Prisma in a finally block
 *
 * This script must NOT be run with confirmation "YES" in non-task contexts that
 * target production or external databases. It is designed for local DEV bootstrap only.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

// Login contract: password minimum length (matches LoginDto @MinLength).
const PASSWORD_MIN_LENGTH = 8;

// --- Guard 1: NODE_ENV ---
if (process.env.NODE_ENV !== 'development') {
  console.error(
    'Error: This script is DEV-only. Set NODE_ENV="development" to proceed.'
  );
  process.exit(1);
}

// --- Guard 2: SEED_ADMIN_PASSWORD ---
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!seedAdminPassword || seedAdminPassword.trim().length === 0) {
  console.error(
    'Error: SEED_ADMIN_PASSWORD environment variable is required and must not be empty.'
  );
  process.exit(1);
}

// Enforce the exact login password minimum length contract declared by LoginDto.
if (seedAdminPassword.trim().length < PASSWORD_MIN_LENGTH) {
  console.error(
    `Error: SEED_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters (LoginDto contract).`
  );
  process.exit(1);
}

// --- Guard 3: Interactive confirmation ---
async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmed = await new Promise<boolean>((resolve) => {
    rl.question(
      'DEV-only command: This will update/create the declared admin user and assign Super Admin role. Proceed? YES to confirm: ',
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
    // Resolve the existing "Super Admin" role by exact name.
    // Do not create, update, delete, migrate, or reassign roles or permissions.
    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'Super Admin' },
    });

    if (!superAdminRole) {
      console.error(
        'Error: Super Admin role not found. Cannot assign Super Admin. No user mutation performed.'
      );
      process.exit(1);
    }

    // Hash SEED_ADMIN_PASSWORD using bcrypt with the repository's existing secure salt-round convention (round 12, matches seed.ts).
    const hashedPassword = await bcrypt.hash(seedAdminPassword, 12);

    // Upsert the single declared admin user by the existing email contract.
    // The email is internal use only, not logged or exposed.
    // Set the user name and active state only to the values already established by the current seed contract.
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@gruposecurity.co' },
      update: {
        password: hashedPassword,
        isActive: true,
      },
      create: {
        email: 'admin@gruposecurity.co',
        password: hashedPassword,
        name: 'Administrador',
        isActive: true,
      },
    });

    // Ensure the user has Super Admin only through the schema's actual user-role relationship.
    // Do not remove any other user role unless the schema contract requires a precise, safe relationship operation.
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    });

    console.log('Admin bootstrap completed successfully.');
  } catch (error) {
    console.error('Error during admin bootstrap:', error);
    process.exit(1);
  } finally {
    // Always disconnect Prisma in a finally block after instantiation.
    await prisma.$disconnect();
  }
}

// Run the main async function (no top-level await).
main().catch((error) => {
  console.error('Fatal error during admin bootstrap:', error);
  process.exit(1);
});