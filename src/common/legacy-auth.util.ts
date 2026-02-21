import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { requireEnv } from './require-env.util';

const jwtSecret = requireEnv('JWT_SECRET');

export function extractLegacyBearerToken(
  headers: Record<string, unknown>,
): string | null {
  const raw =
    (headers['x-http-authorization'] as string | undefined) ??
    (headers['authorization'] as string | undefined) ??
    null;

  if (!raw) {
    return null;
  }

  const match = raw.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new BadRequestException('Token not found in request');
  }

  return match[1] ?? null;
}

export function verifyAndDecodeLegacyJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
      const jwt = new JwtService({
        secret: jwtSecret,
      });
    const payload = jwt.verify(token);

    const issuer = payload.iss;
    if (issuer !== 'your.domain.name') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function decodeLegacyJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
