import { legacyError } from './legacy-response';

function buildBaseUrl(): string {
  const raw =
    process.env.AP_BASE_URL ?? 'https://autoconnect-ap-be.interoffice.al/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, buildBaseUrl()).toString();
}

export async function proxyJsonRequest(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    HTTP_DEV_MODE: process.env.HTTP_DEV_MODE ?? 'false',
  };

  if (token) {
    headers['X-Http-Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      return legacyError(
        `Downstream request failed with status ${response.status}`,
        response.status,
      );
    }

    return parsed;
  } catch {
    return legacyError('Downstream request failed', 500);
  }
}
