import { buildKeywordSQL } from './keyword-filter';

describe('buildKeywordSQL', () => {
  it('returns empty SQL for empty keyword', () => {
    const result = buildKeywordSQL();
    expect(result.sql).toBe('');
    expect(result.params).toEqual([]);
  });

  it('handles encar keyword', () => {
    const result = buildKeywordSQL('encar');
    expect(result.sql).toContain('vendorId = 1');
  });

  it('handles retro keyword', () => {
    const result = buildKeywordSQL('retro');
    expect(result.sql).toContain('registration <');
    expect(result.params.length).toBe(2);
  });

  it('handles korea keyword', () => {
    const result = buildKeywordSQL('korea');
    expect(result.sql).toContain('accountName');
  });

  it('handles comma separated keywords', () => {
    const result = buildKeywordSQL('diesel,automatic');
    expect(result.sql).toContain('OR');
    expect(result.params).toEqual(['%diesel%', '%automatic%']);
  });
});
