import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required — set it in .env',
      );
    }
    super({
      jwtFromRequest: (req: any) => {
        if (req?.cookies?.access_token) {
          return req.cookies.access_token;
        }

        const cookieHeader = req?.headers?.cookie;
        if (cookieHeader) {
          const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]*)/);
          if (match) return decodeURIComponent(match[1]);
        }

        const authHeader = req?.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          return authHeader.substring(7);
        }

        return null;
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
