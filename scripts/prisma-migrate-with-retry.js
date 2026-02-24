const { spawnSync } = require('child_process');

const defaultDatabaseUrl =
  'mysql://root:rootroot@127.0.0.1:3307/vehicle_api_int';
const retries = Number(process.env.INT_DB_MIGRATE_RETRIES || 20);
const delayMs = Number(process.env.INT_DB_MIGRATE_DELAY_MS || 1500);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || defaultDatabaseUrl,
  };

  let lastStatus = 1;
  for (let i = 1; i <= retries; i += 1) {
    const run = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env,
    });

    if (run.status === 0) {
      process.exit(0);
    }

    lastStatus = run.status || 1;
    if (i < retries) {
      console.log(
        `prisma migrate deploy failed (attempt ${i}/${retries}), retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  process.exit(lastStatus);
}

void main();
