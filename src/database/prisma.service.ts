import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { requireEnv } from '../common/require-env.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = requireEnv('DATABASE_URL');
    super({
      adapter: new PrismaMariaDb(databaseUrl),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.ensureImportIdempotencyTable();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async ensureImportIdempotencyTable(): Promise<void> {
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS import_idempotency (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        idempotency_key VARCHAR(255) NOT NULL,
        payload_hash CHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        last_error TEXT NULL,
        attempts INT NOT NULL DEFAULT 1,
        created_at DATETIME(0) NOT NULL,
        updated_at DATETIME(0) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_idempotency_payload (idempotency_key, payload_hash),
        KEY idx_idempotency_status (status),
        KEY idx_idempotency_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }
}
