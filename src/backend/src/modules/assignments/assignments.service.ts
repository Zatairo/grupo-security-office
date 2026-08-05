import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssignmentDto, ASSIGNMENT_RESOURCE_TYPES } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: { userId?: string; resourceType?: string } = {}) {
    const where: { userId?: string; resourceType?: string } = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.resourceType) where.resourceType = filters.resourceType;

    const assignments = await this.prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { data: assignments };
  }

  async create(dto: CreateAssignmentDto) {
    const level = dto.level ?? 'view';

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.validateResource(dto.resourceType, dto.resourceId);

    const existing = await this.prisma.assignment.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId: dto.userId,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
        },
      },
    });

    if (existing?.isActive) {
      throw new ConflictException('Ya existe una asignación activa para ese recurso');
    }

    if (existing) {
      // Soft-delete previo: reactivar el mismo par sin colisión de unique.
      return this.prisma.assignment.update({
        where: { id: existing.id },
        data: { isActive: true, level },
      });
    }

    return this.prisma.assignment.create({
      data: {
        userId: dto.userId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        level,
      },
    });
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asignación no encontrada');

    const data: { level?: string; isActive?: boolean } = {};
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.assignment.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asignación no encontrada');

    if (existing.isActive) {
      await this.prisma.assignment.update({
        where: { id },
        data: { isActive: false },
      });
    }
  }

  private async validateResource(resourceType: string, resourceId: string) {
    if (!(ASSIGNMENT_RESOURCE_TYPES as readonly string[]).includes(resourceType)) {
      throw new NotFoundException(`Tipo de recurso no soportado: ${resourceType}`);
    }

    let resource: { id: string } | null = null;

    if (resourceType === 'CATALOG') {
      resource = await this.prisma.catalog.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    } else if (resourceType === 'PRICE_LIST') {
      resource = await this.prisma.priceList.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    } else if (resourceType === 'CATEGORY') {
      resource = await this.prisma.category.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    }

    if (!resource) {
      throw new NotFoundException(`El recurso ${resourceType} no existe`);
    }
  }
}
