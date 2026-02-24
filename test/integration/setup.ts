const DEFAULT_INT_DATABASE_URL =
  'mysql://root:rootroot@127.0.0.1:3307/vehicle_api_int';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL?.trim() || DEFAULT_INT_DATABASE_URL;
process.env.JWT_SECRET =
  process.env.JWT_SECRET?.trim() || 'integration-test-secret';
process.env.INSTAGRAM_CLIENT_ID =
  process.env.INSTAGRAM_CLIENT_ID?.trim() || 'integration-instagram-client-id';
process.env.INSTAGRAM_CLIENT_SECRET =
  process.env.INSTAGRAM_CLIENT_SECRET?.trim() ||
  'integration-instagram-client-secret';
process.env.INSTAGRAM_REDIRECT_URI =
  process.env.INSTAGRAM_REDIRECT_URI?.trim() || 'http://localhost:3000/callback';
process.env.AP_ADMIN_CODE =
  process.env.AP_ADMIN_CODE?.trim() || 'integration-ap-admin-code';
process.env.ADMIN_CODE =
  process.env.ADMIN_CODE?.trim() || 'integration-admin-code';
process.env.IMPORT_QUEUE_ENABLED = 'false';

const ALLOWLISTED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const originalFetch = global.fetch.bind(globalThis);

function toUrl(input: string | URL | Request): URL | null {
  try {
    if (typeof input === 'string') {
      return new URL(input);
    }
    if (input instanceof URL) {
      return input;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url);
    }
  } catch {
    return null;
  }

  return null;
}

global.fetch = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  if (String(process.env.ALLOW_OUTBOUND_NETWORK).toLowerCase() === 'true') {
    return originalFetch(input as any, init);
  }

  const parsed = toUrl(input);
  if (parsed && !ALLOWLISTED_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Outbound network is blocked in integration tests: ${parsed.hostname}`,
    );
  }

  return originalFetch(input as any, init);
};
