import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccessContext } from '../../common/acl/acl.service';
import { SetMasterKeyDto } from './dto/set-master-key.dto';
import * as bcrypt from 'bcrypt';

/**
 * Clave maestra global (id fijo 'global') para forzar borrados de Listas con datos
 * asociados (productos/precios/accesos). Solo la gestiona Super Admin; cualquier
 * usuario con permiso de borrado (Super Admin / Admin Comercial) puede usarla.
 * El hash NUNCA se expone: getStatus devuelve solo `configured/updatedAt/updatedBy`.
 */
const MASTER_KEY_ID = 'global';

@Injectable()
export class MasterKeyService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getStatus() {
    const record = await this.prisma.masterKey.findUnique({
      where: { id: MASTER_KEY_ID },
    });
    if (!record) {
      return { data: { configured: false, updatedAt: null, updatedBy: null } };
    }

    let updatedBy: { id: string; name: string } | null = null;
    if (record.updatedById) {
      const user = await this.prisma.user.findUnique({
        where: { id: record.updatedById },
        select: { id: true, name: true },
      });
      if (user) updatedBy = user;
    }

    return { data: { configured: true, updatedAt: record.updatedAt, updatedBy } };
  }

  async setMasterKey(dto: SetMasterKeyDto, ctx: AccessContext) {
    const existing = await this.prisma.masterKey.findUnique({
      where: { id: MASTER_KEY_ID },
    });

    if (existing) {
      const currentOk =
        !!dto.currentMasterKey &&
        (await bcrypt.compare(dto.currentMasterKey, existing.keyHash));
      if (!currentOk) {
        throw new ForbiddenException('Clave maestra actual incorrecta');
      }
    }

    const keyHash = await bcrypt.hash(dto.masterKey, 10);
    const record = await this.prisma.masterKey.upsert({
      where: { id: MASTER_KEY_ID },
      create: { id: MASTER_KEY_ID, keyHash, updatedById: ctx.userId ?? null },
      update: { keyHash, updatedById: ctx.userId ?? null },
    });

    // Auditoría SIN valores sensibles: nunca se guarda el hash ni la clave.
    await this.audit.log({
      userId: ctx.userId,
      action: existing ? 'update' : 'create',
      entity: 'MasterKey',
      entityId: record.id,
      newValues: { configured: true },
    });

    return { data: { configured: true, updatedAt: record.updatedAt } };
  }

  async removeMasterKey(ctx: AccessContext) {
    const existing = await this.prisma.masterKey.findUnique({
      where: { id: MASTER_KEY_ID },
    });
    if (!existing) throw new NotFoundException('Clave maestra no configurada');

    await this.prisma.masterKey.delete({ where: { id: MASTER_KEY_ID } });

    await this.audit.log({
      userId: ctx.userId,
      action: 'delete',
      entity: 'MasterKey',
      entityId: MASTER_KEY_ID,
      oldValues: { configured: true },
    });

    return { data: { configured: false } };
  }

  async validateMasterKey(key: string): Promise<boolean> {
    const record = await this.prisma.masterKey.findUnique({
      where: { id: MASTER_KEY_ID },
    });
    if (!record) return false;
    return bcrypt.compare(key, record.keyHash);
  }
}