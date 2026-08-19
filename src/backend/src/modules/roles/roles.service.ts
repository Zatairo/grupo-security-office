import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: roles.map((r) => ({
        ...r,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission),
      })),
    };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
        users: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!role) throw new NotFoundException('Rol no encontrado');

    return {
      ...role,
      permissions: role.permissions.map((p) => p.permission),
      users: role.users.map((ur) => ur.user),
    };
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions?.length
          ? {
              create: dto.permissions.map((permission) => ({ permission })),
            }
          : undefined,
      },
      include: { permissions: true },
    });

    return {
      ...role,
      permissions: role.permissions.map((p) => p.permission),
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.name === 'Super Admin')
      throw new ConflictException('No se puede modificar el rol Super Admin');

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (existing) throw new ConflictException('Ya existe un rol con ese nombre');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;

    if (dto.permissions) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      data.permissions = {
        create: dto.permissions.map((permission) => ({ permission })),
      };
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
      include: { permissions: true },
    });

    return {
      ...updated,
      permissions: updated.permissions.map((p) => p.permission),
    };
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { users: true },
    });

    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.name === 'Super Admin')
      throw new ConflictException('No se puede eliminar el rol Super Admin');
    if (role.users.length > 0) {
      throw new ConflictException('No se puede eliminar un rol asignado a usuarios');
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });

    return { message: 'Rol eliminado exitosamente' };
  }
}
