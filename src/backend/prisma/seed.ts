import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Matriz de permisos por rol (fuente de verdad del negocio).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': [
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
    'users:read', 'users:write', 'users:manage',
    'audit:read',
    'publish:manage',
  ],
  'Supervisor': [
    'products:read',
    'publish:manage',
    'audit:read',
  ],
  'Admin Comercial': [
    'products:read', 'products:write',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
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
  'Admin Comercial': 'Gestión comercial del catálogo, precios y publicación',
  'Operador': 'Consulta del catálogo y precios',
  'Consulta': 'Solo lectura de catálogo y precios',
};

// Equivalencia de roles antiguos a los nuevos según la matriz.
const LEGACY_ROLE_MAPPING: Record<string, string> = {
  Admin: 'Super Admin',
  Gerente: 'Admin Comercial',
  Operator: 'Operador',
  Viewer: 'Consulta',
};

async function upsertRole(name: string) {
  const role = await prisma.role.upsert({
    where: { name },
    update: { description: ROLE_DESCRIPTIONS[name] },
    create: { name, description: ROLE_DESCRIPTIONS[name] },
  });

  // Reemplaza permisos para que el estado final coincida exactamente con la matriz
  // (idempotente: re-ejecutar deja el mismo resultado).
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: ROLE_PERMISSIONS[name].map((permission) => ({
      roleId: role.id,
      permission,
    })),
  });

  return role;
}

async function migrateLegacyRoles() {
  for (const [oldName, newName] of Object.entries(LEGACY_ROLE_MAPPING)) {
    const oldRole = await prisma.role.findUnique({
      where: { name: oldName },
      include: { users: true },
    });

    if (!oldRole) continue;

    // Reasigna usuarios al rol equivalente antes de eliminar.
    const newRole = await prisma.role.findUnique({ where: { name: newName } });
    if (newRole) {
      for (const userRole of oldRole.users) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: userRole.userId, roleId: newRole.id } },
          update: {},
          create: { userId: userRole.userId, roleId: newRole.id },
        });
      }
    }

    // Elimina las asignaciones restantes del rol antiguo; de lo contrario
    // la FK RESTRICT de user_roles impide borrar el rol.
    await prisma.userRole.deleteMany({ where: { roleId: oldRole.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
    await prisma.role.delete({ where: { id: oldRole.id } });

    console.log(`♻️ Rol antiguo "${oldName}" migrado a "${newName}"`);
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create roles (definitivos, en español)
  const superAdminRole = await upsertRole('Super Admin');
  await upsertRole('Supervisor');
  await upsertRole('Admin Comercial');
  await upsertRole('Operador');
  await upsertRole('Consulta');

  console.log('✅ Roles created');

  // Migra roles antiguos (Admin, Gerente, Operator, Viewer) → nuevos
  await migrateLegacyRoles();

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@grupo-security.com' },
    update: {},
    create: {
      email: 'admin@grupo-security.com',
      name: 'Administrador',
      password: hashedPassword,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  console.log('✅ Admin user created (admin@grupo-security.com / admin123) → Super Admin');

  // Create sample categories
  const cctv = await prisma.category.upsert({
    where: { slug: 'cctv' },
    update: {},
    create: { name: 'CCTV', slug: 'cctv', description: 'Sistemas de videovigilancia' },
  });

  const alarmas = await prisma.category.upsert({
    where: { slug: 'alarmas' },
    update: {},
    create: { name: 'Alarmas', slug: 'alarmas', description: 'Sistemas de alarma' },
  });

  const controlAcceso = await prisma.category.upsert({
    where: { slug: 'control-de-acceso' },
    update: {},
    create: { name: 'Control de Acceso', slug: 'control-de-acceso', description: 'Sistemas de control de acceso' },
  });

  const smartHome = await prisma.category.upsert({
    where: { slug: 'smart-home' },
    update: {},
    create: { name: 'Smart Home', slug: 'smart-home', description: 'Domótica y hogar inteligente' },
  });

  // Create subcategories
  await prisma.category.upsert({
    where: { slug: 'camaras-ip' },
    update: {},
    create: { name: 'Cámaras IP', slug: 'camaras-ip', parentId: cctv.id },
  });

  await prisma.category.upsert({
    where: { slug: 'nvr' },
    update: {},
    create: { name: 'NVR', slug: 'nvr', parentId: cctv.id },
  });

  console.log('✅ Categories created');

  // Create sample brands
  await prisma.brand.upsert({
    where: { slug: 'hikvision' },
    update: {},
    create: { name: 'Hikvision', slug: 'hikvision', description: 'Líder mundial en videovigilancia' },
  });

  await prisma.brand.upsert({
    where: { slug: 'dahua' },
    update: {},
    create: { name: 'Dahua', slug: 'dahua', description: 'Soluciones de seguridad' },
  });

  await prisma.brand.upsert({
    where: { slug: 'ajax' },
    update: {},
    create: { name: 'Ajax', slug: 'ajax', description: 'Sistemas de alarma inalámbricos' },
  });

  await prisma.brand.upsert({
    where: { slug: 'honeywell' },
    update: {},
    create: { name: 'Honeywell', slug: 'honeywell', description: 'Tecnología de seguridad y automatización' },
  });

  console.log('✅ Brands created');

  // Create sample price lists
  await prisma.priceList.upsert({
    where: { code: 'MAYORISTA' },
    update: {},
    create: { name: 'Lista Mayorista', code: 'MAYORISTA', currency: 'COP' },
  });

  await prisma.priceList.upsert({
    where: { code: 'DETALLE' },
    update: {},
    create: { name: 'Lista Detalle', code: 'DETALLE', currency: 'COP' },
  });

  console.log('✅ Price lists created');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
