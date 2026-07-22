import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };
  }

  async login(user: { id: string; email: string; name: string; roles: string[]; permissions: string[] }) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
    };

    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };
  }
}
