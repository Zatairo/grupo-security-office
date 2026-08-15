import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService, AccessContext } from '../../common/acl/acl.service';
import { AuditService } from '../audit/audit.service';
import { CreateAssignmentDto, ASSIGNMENT_RESOURCE_TYPES } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private acl: AclService,
    private audit: AuditService,
  ) {}

  /**
   * Lista asignaciones.
   * - Super Admin (o ctx ausente: legacy/test) → todas.
   * - Admin Comercial → solo LISTA sobre las que administra (level manage),
   *   más las de tipos legacy que administre (ninguna, por política).
   * - Resto → deny (lista vacía).
   */
  async findAll(
    filters: { userId?: string; resourceType?: string } = {},
    ctx?: AccessContext,
  ) {
    if (!ctx || !ctx.userId || this.acl.isSuperAdmin(ctx.roles)) {
      const where: { userId?: string; resourceType?: string } = {};
      if (filters.userId) where.userId = filters.userId;
      if (filters.resourceType) where.resourceType = filters.resourceType;
      const assignments = await this.prisma.assignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return { data: assignments };
    }

    // Non-Super Admin: scope a LISTA bajo su administración (manage).
    const manageLevel = this.acl.levelsAtLeast('manage');
    const allowed = await this.prisma.assignment.findMany({
      where: {
        userId: ctx.userId,
        resourceType: 'LISTA',
        isActive: true,
        level: { in: manageLevel },
      },
      select: { resourceId: true },
    });

    // Si no administra ninguna Lista → deny (lista vacía).
    if (allowed.length === 0) {
      return { data: [] };
    }

    const where: {
      userId?: string;
      resourceType?: string;
      resourceId: { in: string[] };
    } = { resourceId: { in: allowed.map((a) => a.resourceId) } };
    if (filters.userId) where.userId = filters.userId;
    if (filters.resourceType === 'LISTA') where.resourceType = filters.resourceType;

    const assignments = await this.prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { data: assignments };
  }

  async create(dto: CreateAssignmentDto, ctx?: AccessContext) {
    const level = dto.level ?? 'view';

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.validateResource(dto.resourceType, dto.resourceId);
    await this.authorizeAssignmentMutation(dto.resourceType, dto.resourceId, ctx);

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
      const reactivated = await this.prisma.assignment.update({
        where: { id: existing.id },
        data: { isActive: true, level },
      });

      await this.audit.log({
        userId: ctx?.userId,
        action: 'update',
        entity: 'Assignment',
        entityId: existing.id,
        oldValues: { level: existing.level, isActive: existing.isActive },
        newValues: { level, isActive: true },
      });

      return reactivated;
    }

    const created = await this.prisma.assignment.create({
      data: {
        userId: dto.userId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        level,
      },
    });

    await this.audit.log({
      userId: ctx?.userId,
      action: 'create',
      entity: 'Assignment',
      entityId: created.id,
      newValues: {
        userId: created.userId,
        resourceType: created.resourceType,
        resourceId: created.resourceId,
        level: created.level,
      },
    });

    return created;
  }

  async update(id: string, dto: UpdateAssignmentDto, ctx?: AccessContext) {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asignación no encontrada');

    await this.authorizeAssignmentMutation(existing.resourceType, existing.resourceId, ctx);

    const data: { level?: string; isActive?: boolean } = {};
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.assignment.update({ where: { id }, data });

    await this.audit.log({
      userId: ctx?.userId,
      action: 'update',
      entity: 'Assignment',
      entityId: id,
      oldValues: { level: existing.level, isActive: existing.isActive },
      newValues: data,
    });

    return updated;
  }

  async remove(id: string, ctx?: AccessContext) {
    const existing = await this.prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Asignación no encontrada');

    await this.authorizeAssignmentMutation(existing.resourceType, existing.resourceId, ctx);

    if (existing.isActive) {
      await this.prisma.assignment.update({
        where: { id },
        data: { isActive: false },
      });

      await this.audit.log({
        userId: ctx?.userId,
        action: 'delete',
        entity: 'Assignment',
        entityId: id,
        oldValues: { level: existing.level, isActive: existing.isActive },
        newValues: { isActive: false },
      });
    }
  }

  /**
   * Autoriza mutaciones sobre una asignación según su tipo de recurso.
   * - LISTA → Super Admin, o Admin Comercial con `manage` sobre la Lista.
   * - Tipos legacy (PRICE_LIST/CATEGORY) → Super Admin exclusivamente.
   * - ctx ausente (legacy/tests) → permitir (la capa de RolesGuard controla acceso).
   */
  private async authorizeAssignmentMutation(
    resourceType: string,
    resourceId: string,
    ctx?: AccessContext,
  ): Promise<void> {
    if (!ctx || !ctx.userId || this.acl.isSuperAdmin(ctx.roles)) return;

    if (resourceType === 'LISTA') {
      if (!ctx.roles.includes('Admin Comercial')) {
        throw new ForbiddenException('No tienes permisos para administrar asignaciones');
      }
      if (!(await this.acl.can(resourceId, ctx, 'manage'))) {
        throw new ForbiddenException('No tienes permisos de administración sobre esta Lista');
      }
      return;
    }

    // Tipos legacy: solo Super Admin (ya retornado arriba).
    throw new ForbiddenException(
      'Solo Super Admin puede administrar asignaciones de este tipo de recurso',
    );
  }

  private async validateResource(resourceType: string, resourceId: string) {
    if (!(ASSIGNMENT_RESOURCE_TYPES as readonly string[]).includes(resourceType)) {
      throw new NotFoundException(`Tipo de recurso no soportado: ${resourceType}`);
    }

    let resource: { id: string } | null = null;

    if (resourceType === 'PRICE_LIST') {
      resource = await this.prisma.priceList.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    } else if (resourceType === 'CATEGORY') {
      resource = await this.prisma.category.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    } else if (resourceType === 'LISTA') {
      resource = await this.prisma.lista.findUnique({
        where: { id: resourceId },
        select: { id: true },
      });
    }

    if (!resource) {
      throw new NotFoundException(`El recurso ${resourceType} no existe`);
    }
  }
}
