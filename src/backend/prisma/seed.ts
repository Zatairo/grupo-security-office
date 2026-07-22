import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Acceso total al sistema',
    },
  });

  const gerenteRole = await prisma.role.upsert({
    where: { name: 'Gerente' },
    update: {},
    create: {
      name: 'Gerente',
      description: 'Gestión de productos, precios y publicación',
    },
  });

  const operatorRole = await prisma.role.upsert({
    where: { name: 'Operator' },
    update: {},
    create: {
      name: 'Operator',
      description: 'Edición limitada de productos y consulta de precios',
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Solo lectura del catálogo',
    },
  });

  console.log('✅ Roles created');

  // Create permissions
  const allPermissions = [
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
    'users:read', 'users:write', 'users:manage',
    'audit:read',
    'publish:manage',
  ];

  const gerentePermissions = [
    'products:read', 'products:write',
    'categories:read', 'categories:write',
    'brands:read', 'brands:write',
    'prices:read', 'prices:write',
    'audit:read',
    'publish:manage',
  ];

  const operatorPermissions = [
    'products:read', 'products:write',
    'categories:read',
    'brands:read',
    'prices:read',
  ];

  const viewerPermissions = [
    'products:read',
    'categories:read',
    'brands:read',
    'prices:read',
  ];

  // Assign permissions to roles
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId: adminRole.id, permission } },
      update: {},
      create: { roleId: adminRole.id, permission },
    });
  }

  for (const permission of gerentePermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId: gerenteRole.id, permission } },
      update: {},
      create: { roleId: gerenteRole.id, permission },
    });
  }

  for (const permission of operatorPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId: operatorRole.id, permission } },
      update: {},
      create: { roleId: operatorRole.id, permission },
    });
  }

  for (const permission of viewerPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId: viewerRole.id, permission } },
      update: {},
      create: { roleId: viewerRole.id, permission },
    });
  }

  console.log('✅ Permissions assigned');

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
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log('✅ Admin user created (admin@grupo-security.com / admin123)');

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
