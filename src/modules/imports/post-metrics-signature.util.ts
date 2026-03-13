import { createHmac, timingSafeEqual } from 'crypto';

const POST_METRICS_SIGNATURE_WINDOW_MS = 60_000;

export type SignedMetricType =
  | 'postOpen'
  | 'impressions'
  | 'reach'
  | 'clicks'
  | 'contact';

export type SignedContactMethod =
  | 'call'
  | 'whatsapp'
  | 'email'
  | 'instagram';

function getPostMetricsSigningSecret(): string {
  const secret = String(process.env.POST_METRICS_SIGNING_SECRET ?? '').trim();
  if (!secret) {
    throw new Error(
      'POST_METRICS_SIGNING_SECRET is required for metric signature verification.',
    );
  }
  return secret;
}

export function buildPostMetricSignaturePayload(input: {
  timestamp: string;
  postId: string;
  metric: SignedMetricType;
  visitorId?: string;
  contactMethod?: SignedContactMethod;
}): string {
  return new URLSearchParams([
    ['ts', input.timestamp],
    ['postId', input.postId],
    ['metric', input.metric],
    ['visitorId', input.visitorId ?? ''],
    ['contactMethod', input.contactMethod ?? ''],
  ]).toString();
}

export function signPostMetricRequest(input: {
  timestamp: string;
  postId: string;
  metric: SignedMetricType;
  visitorId?: string;
  contactMethod?: SignedContactMethod;
}): string {
  return createHmac('sha256', getPostMetricsSigningSecret())
    .update(buildPostMetricSignaturePayload(input))
    .digest('hex');
}

export function verifyPostMetricRequestSignature(input: {
  timestamp?: string;
  signature?: string;
  postId: string;
  metric: SignedMetricType;
  visitorId?: string;
  contactMethod?: SignedContactMethod;
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

  if (Math.abs(Date.now() - parsedTimestamp) > POST_METRICS_SIGNATURE_WINDOW_MS) {
    return { valid: false, reason: 'stale' };
  }

  const expected = signPostMetricRequest({
    timestamp,
    postId: input.postId,
    metric: input.metric,
    visitorId: input.visitorId,
    contactMethod: input.contactMethod,
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
