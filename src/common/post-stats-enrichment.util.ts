import type { PrismaService } from '../database/prisma.service';

export type PostStatsProjection = {
  impressions: number;
  reach: number;
  clicks: number;
  contactCount: number;
  contactCall: number;
  contactWhatsapp: number;
  contactEmail: number;
  contactInstagram: number;
};

type PostStatsRow = {
  id: bigint;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  contact: number | null;
  contactCall: number | null;
  contactWhatsapp: number | null;
  contactEmail: number | null;
  contactInstagram: number | null;
};

const ZERO_POST_STATS: PostStatsProjection = Object.freeze({
  impressions: 0,
  reach: 0,
  clicks: 0,
  contactCount: 0,
  contactCall: 0,
  contactWhatsapp: 0,
  contactEmail: 0,
  contactInstagram: 0,
});

function toPostId(value: unknown): string | null {
  if (typeof value === 'bigint') {
    return value > 0n ? value.toString() : null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const normalized = Math.trunc(value);
    return normalized > 0 ? String(normalized) : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;
    return normalized;
  }
  return null;
}

function toNonNegativeInt(value: unknown): number {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.trunc(numericValue));
}

function projectStats(row?: PostStatsRow): PostStatsProjection {
  if (!row) {
    return { ...ZERO_POST_STATS };
  }
  return {
    impressions: toNonNegativeInt(row.impressions),
    reach: toNonNegativeInt(row.reach),
    clicks: toNonNegativeInt(row.clicks),
    contactCount: toNonNegativeInt(row.contact),
    contactCall: toNonNegativeInt(row.contactCall),
    contactWhatsapp: toNonNegativeInt(row.contactWhatsapp),
    contactEmail: toNonNegativeInt(row.contactEmail),
    contactInstagram: toNonNegativeInt(row.contactInstagram),
  };
}

function withStats(row: unknown, stats: PostStatsProjection): unknown {
  if (!row || typeof row !== 'object') {
    return row;
  }
  return {
    ...(row as Record<string, unknown>),
    ...stats,
  };
}

function collectPostIds(rows: unknown[]): bigint[] {
  const deduped = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = toPostId((row as Record<string, unknown>).id);
    if (id) {
      deduped.add(id);
    }
  }
  return Array.from(deduped).map((id) => BigInt(id));
}

export async function enrichRowsWithPostStats(
  prisma: Pick<PrismaService, 'post'> | null | undefined,
  rows: unknown[],
): Promise<unknown[]> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const hasPostRepo =
    prisma &&
    prisma.post &&
    typeof prisma.post.findMany === 'function';
  if (!hasPostRepo) {
    return rows.map((row) => withStats(row, { ...ZERO_POST_STATS }));
  }

  const postIds = collectPostIds(rows);
  if (postIds.length === 0) {
    return rows.map((row) => withStats(row, { ...ZERO_POST_STATS }));
  }

  const statsRows = await prisma.post.findMany({
    where: {
      id: { in: postIds },
    },
    select: {
      id: true,
      impressions: true,
      reach: true,
      clicks: true,
      contactCall: true,
      contactWhatsapp: true,
      contactEmail: true,
      contactInstagram: true,
      contact: true,
    },
  });

  const statsById = new Map<string, PostStatsProjection>();
  for (const row of statsRows) {
    const mappedRow = row as unknown as PostStatsRow;
    statsById.set(mappedRow.id.toString(), projectStats(mappedRow));
  }

  return rows.map((row) => {
    if (!row || typeof row !== 'object') {
      return row;
    }
    const id = toPostId((row as Record<string, unknown>).id);
    const stats = id ? statsById.get(id) : undefined;
    return withStats(row, stats ?? { ...ZERO_POST_STATS });
  });
}
