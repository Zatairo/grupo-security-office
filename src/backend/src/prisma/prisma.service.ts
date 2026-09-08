import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Driver adapter en vez del motor nativo en Rust: evita el panic
// "PANIC: timer has gone away" del conector nativo de Prisma en
// hosting compartido (ver comentario en schema.prisma). Pool (no el
// cliente HTTP-only `neon()`) para soportar $transaction interactivo,
// usado por el pipeline de importación (SAVEPOINT por fila).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
