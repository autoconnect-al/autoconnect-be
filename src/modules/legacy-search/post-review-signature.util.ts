import { createHmac, timingSafeEqual } from 'crypto';

const POST_REVIEW_SIGNATURE_WINDOW_MS = 60_000;

export type PostReviewType = 'like' | 'dislike';

function getPostReviewSigningSecret(): string {
  const reviewSecret = String(process.env.POST_REVIEWS_SIGNING_SECRET ?? '').trim();
  if (reviewSecret) {
    return reviewSecret;
  }

  const metricsFallback = String(
    process.env.POST_METRICS_SIGNING_SECRET ?? '',
  ).trim();
  if (metricsFallback) {
    return metricsFallback;
  }

  throw new Error(
    'POST_REVIEWS_SIGNING_SECRET (or POST_METRICS_SIGNING_SECRET fallback) is required for review signature verification.',
  );
}

export function buildPostReviewSignaturePayload(input: {
  timestamp: string;
  postId: string;
  reviewType: PostReviewType;
  reasonKey?: string;
  message?: string;
  visitorId?: string;
}): string {
  return new URLSearchParams([
    ['ts', input.timestamp],
    ['postId', input.postId],
    ['reviewType', input.reviewType],
    ['reasonKey', input.reasonKey ?? ''],
    ['message', input.message ?? ''],
    ['visitorId', input.visitorId ?? ''],
  ]).toString();
}

export function signPostReviewRequest(input: {
  timestamp: string;
  postId: string;
  reviewType: PostReviewType;
  reasonKey?: string;
  message?: string;
  visitorId?: string;
}): string {
  return createHmac('sha256', getPostReviewSigningSecret())
    .update(buildPostReviewSignaturePayload(input))
    .digest('hex');
}

export function verifyPostReviewRequestSignature(input: {
  timestamp?: string;
  signature?: string;
  postId: string;
  reviewType: PostReviewType;
  reasonKey?: string;
  message?: string;
  visitorId?: string;
}): { valid: boolean; reason?: 'missing' | 'stale' | 'invalid' } {
  const timestamp = input.timestamp?.trim();
  const signature = input.signature?.trim();

  if (!timestamp || !signature) {
    return { valid: false, reason: 'missing' };
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return { valid: false, reason: 'invalid' };
  }

  if (Math.abs(Date.now() - parsedTimestamp) > POST_REVIEW_SIGNATURE_WINDOW_MS) {
    return { valid: false, reason: 'stale' };
  }

  const expected = signPostReviewRequest({
    timestamp,
    postId: input.postId,
    reviewType: input.reviewType,
    reasonKey: input.reasonKey,
    message: input.message,
    visitorId: input.visitorId,
  });

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return { valid: false, reason: 'invalid' };
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
    ? { valid: true }
    : { valid: false, reason: 'invalid' };
}
