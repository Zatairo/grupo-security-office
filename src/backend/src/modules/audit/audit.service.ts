import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValues: params.oldValues ?? undefined,
        newValues: params.newValues ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    entity?: string;
    entityId?: string;
    userId?: string;
    action?: string;
  }) {
    const { skip = 0, take = 50, entity, entityId, userId, action } = params || {};

    const where: Prisma.AuditLogWhereInput = {
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, skip, take },
    };
  }

  async findByEntity(entity: string, entityId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: logs };
  }
}
