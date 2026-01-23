import { normalizeGeneralSearch } from './search-normalizer';
import { BadRequestException } from '@nestjs/common';

describe('normalizeGeneralSearch', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeGeneralSearch()).toEqual([]);
  });

  it('normalizes known typos', () => {
    expect(normalizeGeneralSearch('benc mercedez')).toEqual([
      'benz',
      'mercedes',
    ]);
  });

  it('combines T Max into tmax', () => {
    expect(normalizeGeneralSearch('yamaha t max')).toContain('tmax');
  });

  it('handles series swap', () => {
    expect(normalizeGeneralSearch('bmw series 3')).toContain('3-series');
  });

  it('combines single char models', () => {
    expect(normalizeGeneralSearch('a 4')).toContain('a 4');
  });

  it('throws if search too long', () => {
    expect(() => normalizeGeneralSearch('a'.repeat(76))).toThrow(
      BadRequestException,
    );
  });

  it('limits token count to 10', () => {
    const input = Array(12).fill('test').join(' ');
    expect(normalizeGeneralSearch(input).length).toBeLessThanOrEqual(10);
  });
});
