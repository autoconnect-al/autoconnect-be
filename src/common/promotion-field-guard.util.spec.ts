import {
  PROMOTION_FIELD_KEYS,
  sanitizePostUpdateDataForSource,
} from './promotion-field-guard.util';

describe('sanitizePostUpdateDataForSource', () => {
  it('strips promotion fields for untrusted sources', () => {
    const input = {
      status: 'DRAFT',
      promotionTo: 1,
      highlightedTo: 2,
      renewTo: 3,
      mostWantedTo: 4,
      renewInterval: 'weekly',
      renewedTime: 5,
    };

    const result = sanitizePostUpdateDataForSource(input, 'untrusted');

    for (const key of PROMOTION_FIELD_KEYS) {
      expect(result).not.toHaveProperty(key);
    }
    expect(result.status).toBe('DRAFT');
  });

  it('keeps promotion fields for payments source', () => {
    const input = { promotionTo: 123, renewTo: 456 };

    const result = sanitizePostUpdateDataForSource(input, 'payments');

    expect(result.promotionTo).toBe(123);
    expect(result.renewTo).toBe(456);
  });

  it('keeps promotion fields for autoRenew source', () => {
    const input = { renewTo: 789, renewedTime: 800 };

    const result = sanitizePostUpdateDataForSource(input, 'autoRenew');

    expect(result.renewTo).toBe(789);
    expect(result.renewedTime).toBe(800);
  });
});
