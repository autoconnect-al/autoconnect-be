export const PROMOTION_FIELD_KEYS = [
  'promotionTo',
  'highlightedTo',
  'renewTo',
  'mostWantedTo',
  'renewInterval',
  'renewedTime',
] as const;

export type PromotionFieldKey = (typeof PROMOTION_FIELD_KEYS)[number];

export type PromotionUpdateSource = 'payments' | 'autoRenew' | 'untrusted';

const ALLOWED_PROMOTION_WRITE_SOURCES = new Set<PromotionUpdateSource>([
  'payments',
  'autoRenew',
]);

export function sanitizePostUpdateDataForSource<T extends Record<string, unknown>>(
  data: T,
  source: PromotionUpdateSource,
): T {
  if (ALLOWED_PROMOTION_WRITE_SOURCES.has(source)) {
    return data;
  }

  const sanitized = { ...data } as Record<string, unknown>;
  for (const key of PROMOTION_FIELD_KEYS) {
    delete sanitized[key];
  }

  return sanitized as T;
}
