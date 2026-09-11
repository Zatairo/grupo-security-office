import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessContext } from '../acl/acl.service';
import { TeamNode } from './types';

@Injectable()
export class HierarchyService {
  constructor(private prisma: PrismaService) {}

  // Get all subordinate IDs (direct and indirect)
  async getSubordinateIds(
    userId: string,
    opts?: { includeSelf?: boolean; maxDepth?: number },
  ): Promise<string[]> {
    const maxDepth = opts?.maxDepth ?? 10;

    const result = await this.prisma.$queryRaw<
      Array<{ id: string; depth: number }>
    >`
      WITH RECURSIVE sub AS (
        SELECT u."id", 0 AS depth, ARRAY[u."id"] AS path
        FROM "users" u
        WHERE u."id" = ${userId}
        UNION ALL
        SELECT c."id", s.depth + 1, s.path || c."id"
        FROM "users" c
        JOIN sub s ON c."supervisorId" = s."id"
        WHERE NOT (c."id" = ANY(s.path))
          AND s.depth < ${maxDepth}
      )
      SELECT "id", depth FROM sub WHERE depth > 0
    `;

    if (opts?.includeSelf) {
      return [userId, ...result.map((r) => r.id)];
    }

    return result.map((r) => r.id);
  }

  // Get all ancestor IDs (superiors up the chain)
  async getAncestorIds(userId: string): Promise<string[]> {
    const result = await this.prisma.$queryRaw<
      Array<{ id: string; depth: number }>
    >`
      WITH RECURSIVE anc AS (
        SELECT u."id", 0 AS depth, ARRAY[u."id"] AS path
        FROM "users" u
        WHERE u."id" = ${userId}
        UNION ALL
        SELECT s."id", anc.depth + 1, anc.path || s."id"
        FROM "users" s
        JOIN anc ON anc."supervisorId" = s."id"
        WHERE NOT (s."id" = ANY(anc.path))
          AND anc.depth < 10
      )
      SELECT "id", depth FROM anc WHERE depth > 0
    `;

    return result.map((r) => r.id);
  }

  // Get hierarchical team tree starting from userId
  async getTeamTree(userId: string): Promise<TeamNode> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const buildTree = async (uid: string, depth: number): Promise<TeamNode> => {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, name: true, email: true },
      });

      if (!currentUser) {
        throw new Error(`User ${uid} not found`);
      }

      const subordinates = await this.prisma.user.findMany({
        where: { supervisorId: uid },
        select: { id: true, name: true, email: true },
      });

      const childrenTrees = await Promise.all(
        subordinates.map((sub) => buildTree(sub.id, depth + 1)),
      );

      return {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        depth,
        children: childrenTrees,
      };
    };

    return buildTree(userId, 0);
  }

  // Check if ctx.userId can view targetUserId
  async assertCanViewUser(
    ctx: AccessContext,
    targetUserId: string,
  ): Promise<void> {
    // Super Admin can view anyone
    if (ctx.roles?.includes('Super Admin')) {
      return;
    }

    // User can view themselves
    if (ctx.userId === targetUserId) {
      return;
    }

    // Supervisor can view their subordinates
    const subordinateIds = await this.getSubordinateIds(ctx.userId);
    if (subordinateIds.includes(targetUserId)) {
      return;
    }

    throw new ForbiddenException(
      `User ${ctx.userId} cannot view user ${targetUserId}`,
    );
  }

  // Check if assigning supervisorId to userId would create a cycle
  async assertCanSetSupervisor(
    userId: string,
    supervisorId: string | null,
  ): Promise<void> {
    // Setting supervisor to null is always allowed
    if (supervisorId === null) {
      return;
    }

    // Get all ancestors of the proposed supervisor (including the supervisor themselves)
    const ancestors = await this.getAncestorIds(supervisorId);
    const allAncestors = [supervisorId, ...ancestors];

    // If userId is in the ancestors of supervisorId, it would create a cycle
    if (allAncestors.includes(userId)) {
      throw new ConflictException(
        'Asignar este supervisor crearía un ciclo en la jerarquía',
      );
    }
  }
}
