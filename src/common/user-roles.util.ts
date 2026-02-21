import type { PrismaService } from '../database/prisma.service';

type RoleRow = { name: string | null };

export async function getUserRoleNames(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<RoleRow[]>(
      `
        SELECT r.name
        FROM user_role ur
        JOIN role r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND r.deleted = 0
      `,
      BigInt(userId),
    );

    const normalized = rows
      .map((row) => String(row.name ?? '').trim().toUpperCase())
      .filter((name) => name.length > 0);

    if (normalized.length > 0) {
      return Array.from(new Set(normalized));
    }
  } catch {
    // Keep legacy behavior fallback if role lookup is unavailable.
  }

  return ['USER'];
}
