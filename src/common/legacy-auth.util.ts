import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const defaultJwtSecret = `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgHhtbw0Ojj24oDS1NFTg4jJaNNulbn1tAYlgTaoua1Fogkmtbhed
p3wMaJu0PHrCNM4DZeBA1XxpQcDuTSLukkSVRGqRsrSB3UyRfc3ykINN0/nQmTvh
C3WxyOF/xTAfa3r4d/aMs+knBtBvXR8NS6C6Nfd+eSr3mfMlPB31Sfn7AgMBAAEC
gYA2+zeFTYzxbvZtugE/c0CyXm7djSTpzLez4azzsqe6ji1VuAGYdJj/0KZ92Ab4
wOvc1r5PaSpO17t2exXqieNrF+GTM2t0e8IjjuI65wcWLtmmorSgxOaix2Ytww9m
7VSvjjkjMSXFKssmhrnnHwu5+Bi74xoQRQf/G9k3OsSZoQJBAOgfSqVwZGnaU6yi
bAQwW900XT7gDLr7gXQWzAGdvSIUYh2Elrr+rcXrlZ+xPRbsTTLIlmtmeqo9kCwe
d7B2fpECQQCE0MWQgBZHrfePHta7zU7XGTZBUljhMVVOldTEALVVhTBBn6kA62V8
iKOudmJX9AtPe6aITBzKK+qcTI1UIk3LAkEAt9mxAgBXSBAJHj83VsoGuNn00Qwc
iS0Th6NWyiDp4MhMPhz6VfnKIW1LAUUcob9gFc0SdtagaZ6BRrCLFFWGQQJAD1fa
6vWRHVjAl50Va36tU/YKqYMs118OntR6TuZSDH4lc/9Q09Vd1QQn/JiahdSgld8P
/wDj9osaQFIrpYOM/wJAWW38Ogcp70SPtAyV1kl4jP38jyXFD+M3VESBrhZRzz5E
F4RzDtfTdh+Oy9rr11Fr9HvlTQeNhBTTOc4veOpd3A==
-----END RSA PRIVATE KEY-----`;

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
      secret: process.env.JWT_SECRET ?? defaultJwtSecret,
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
