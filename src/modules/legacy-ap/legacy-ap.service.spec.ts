import { LegacyApService } from './legacy-ap.service';

describe('LegacyApService createdTime conversion', () => {
  const createService = () =>
    new LegacyApService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

  it('accepts unix seconds as string', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('1770995188');
    expect(value).toBe(1770995188n);
  });

  it('accepts unix milliseconds and normalizes to seconds', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('1770995188000');
    expect(value).toBe(1770995188n);
  });

  it('accepts ISO date string and converts to seconds', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('2026-02-15T13:31:54.903Z');
    expect(value).toBe(1771162314n);
  });

  it('returns null for invalid date/text', () => {
    const service = createService();
    expect((service as any).toNullableBigInt('not-a-date')).toBeNull();
  });
});
