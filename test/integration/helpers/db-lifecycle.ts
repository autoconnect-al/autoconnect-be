import { execSync } from 'child_process';
import { PrismaService } from '../../../src/database/prisma.service';

const RESET_TABLES_IN_DELETE_ORDER = [
  'post_reach_unique',
  'car_detail',
  'search',
  'post',
  'customer_orders',
  'promotion_packages',
  'vendor_role',
  'vendor',
  'user',
  'role',
];
let prisma: PrismaService | null = null;
let didRunMigrations = false;

export function getPrisma(): PrismaService {
  if (!prisma) {
    prisma = new PrismaService();
  }
  return prisma;
}

export async function waitForDatabaseReady(
  timeoutMs = 60_000,
  intervalMs = 1_000,
): Promise<void> {
  const db = getPrisma();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      await db.$connect();
      await db.$queryRawUnsafe('SELECT 1');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Database was not ready after ${timeoutMs}ms.`);
}

export async function runMigrationsOnce(): Promise<void> {
  if (didRunMigrations) {
    return;
  }

  const defaultUrl = 'mysql://root:rootroot@127.0.0.1:3307/vehicle_api_int';
  const databaseUrl = process.env.DATABASE_URL || defaultUrl;

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  const db = getPrisma();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS customer_orders (
      id BIGINT UNSIGNED NOT NULL,
      dateCreated DATETIME(0) NOT NULL,
      dateUpdated DATETIME(0) NULL,
      capturedAt DATETIME(0) NULL,
      deleted TINYINT(1) NOT NULL DEFAULT 0,
      captureKey VARCHAR(255) NULL,
      paypalId VARCHAR(255) NULL,
      postId VARCHAR(255) NULL,
      packages VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      phoneNumber VARCHAR(255) NULL,
      fullName VARCHAR(255) NULL,
      status VARCHAR(40) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY customer_orders_capture_key_uq (captureKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS promotion_packages (
      id INT NOT NULL,
      dateCreated DATETIME(0) NOT NULL,
      dateUpdated DATETIME(0) NULL,
      name VARCHAR(20) NOT NULL,
      price FLOAT NOT NULL,
      deleted TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureColumn(
    db,
    'vendor',
    'merrjep_username',
    'ALTER TABLE vendor ADD COLUMN merrjep_username VARCHAR(255) NULL',
  );
  await ensureColumn(
    db,
    'car_detail',
    'fuelVerified',
    'ALTER TABLE car_detail ADD COLUMN fuelVerified TINYINT(1) NULL DEFAULT 0',
  );
  await ensureColumn(
    db,
    'car_detail',
    'mileageVerified',
    'ALTER TABLE car_detail ADD COLUMN mileageVerified TINYINT(1) NULL DEFAULT 0',
  );
  await ensureColumn(
    db,
    'car_detail',
    'canExchange',
    'ALTER TABLE car_detail ADD COLUMN canExchange TINYINT(1) NULL',
  );

  didRunMigrations = true;
}

export async function resetDatabase(): Promise<void> {
  const db = getPrisma();
  for (const tableName of RESET_TABLES_IN_DELETE_ORDER) {
    await db.$executeRawUnsafe(`DELETE FROM \`${tableName}\``);
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!prisma) {
    return;
  }
  await prisma.$disconnect();
  prisma = null;
}

async function ensureColumn(
  db: PrismaService,
  tableName: string,
  columnName: string,
  alterSql: string,
): Promise<void> {
  const rows = await db.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    tableName,
    columnName,
  );
  const total = Number(rows[0]?.total ?? 0);
  if (total === 0) {
    await db.$executeRawUnsafe(alterSql);
  }
}
