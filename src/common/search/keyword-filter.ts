export function buildKeywordSQL(keyword?: string): {
  sql: string;
  params: any[];
} {
  if (!keyword) return { sql: '', params: [] };

  const kw = keyword.toLowerCase();

  if (kw === 'encar') {
    return { sql: 'AND vendorId = 1', params: [] };
  }

  if (kw === 'retro') {
    const year = new Date().getFullYear() - 30;
    return {
      sql: 'AND (cleanedCaption LIKE ? OR registration < ?)',
      params: ['%retro%', year],
    };
  }

  if (kw === 'korea') {
    return {
      sql: 'AND (cleanedCaption LIKE ? OR accountName LIKE ?)',
      params: ['%korea%', '%korea%'],
    };
  }

  const parts = kw.split(',').filter(Boolean);
  if (!parts.length) return { sql: '', params: [] };

  return {
    sql: `AND (${parts.map(() => 'cleanedCaption LIKE ?').join(' OR ')})`,
    params: parts.map(p => `%${p}%`),
  };
}
