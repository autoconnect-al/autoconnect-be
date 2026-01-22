import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

// IMPORTANT:
// - If you generate client to the default location: use '@prisma/client'
// - If you generate to a custom output (like ../generated/prisma): import from that output
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    // Prisma 7: pass adapter to PrismaClient constructor
    const adapter = new PrismaMariaDb(databaseUrl);

    super({
      adapter,
      // optional logging:
      // log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
