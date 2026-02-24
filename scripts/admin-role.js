#!/usr/bin/env node
const path = require('path');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function usage() {
  console.log('Usage: node scripts/admin-role.js <grant|revoke> <userId>');
}

async function main() {
  const action = process.argv[2];
  const userId = process.argv[3];

  if (!action || !userId || !['grant', 'revoke'].includes(action)) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!/^\d+$/.test(userId)) {
    console.error('Invalid userId. Must be a numeric id.');
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
  });

  try {
    const user = await prisma.vendor.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, deleted: true },
    });
    if (!user || user.deleted) {
      console.error(`User ${userId} was not found or is deleted.`);
      process.exitCode = 1;
      return;
    }

    let adminRole = await prisma.role.findFirst({
      where: { name: 'ADMIN', deleted: false },
      select: { id: true },
    });

    if (!adminRole && action === 'grant') {
      const created = await prisma.role.create({
        data: {
          name: 'ADMIN',
          deleted: false,
          dateCreated: new Date(),
          dateUpdated: new Date(),
        },
        select: { id: true },
      });
      adminRole = created;
    }

    if (!adminRole) {
      console.error('ADMIN role is not configured.');
      process.exitCode = 1;
      return;
    }

    if (action === 'grant') {
      await prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
        BigInt(userId),
        adminRole.id,
      );
      console.log(`Granted ADMIN role to user ${userId}.`);
      return;
    }

    const adminLinks = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE role_id = ?',
      adminRole.id,
    );
    const totalAdmins = Number(adminLinks[0]?.total ?? 0n);
    const targetLinks = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      BigInt(userId),
      adminRole.id,
    );
    const targetIsAdmin = Number(targetLinks[0]?.total ?? 0n) > 0;

    if (targetIsAdmin && totalAdmins <= 1) {
      console.error('Cannot remove the last ADMIN user.');
      process.exitCode = 1;
      return;
    }

    await prisma.$executeRawUnsafe(
      'DELETE FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      BigInt(userId),
      adminRole.id,
    );
    console.log(`Revoked ADMIN role from user ${userId}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
