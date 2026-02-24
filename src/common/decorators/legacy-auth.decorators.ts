import { createParamDecorator, ExecutionContext, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import {
  extractLegacyBearerToken,
  verifyAndDecodeLegacyJwtPayload,
} from '../legacy-auth.util';

type LegacyRequest = Request & {
  legacyJwtPayload?: Record<string, unknown>;
};

function unauthorized(): never {
  throw new HttpException(
    {
      success: false,
      message: 'ERROR: Not authorised',
      statusCode: '401',
    },
    401,
  );
}

export const LegacyUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<LegacyRequest>();
    const payload = request.legacyJwtPayload;
    const userId = payload?.userId;
    if (typeof userId === 'string' && userId.length > 0) return userId;
    if (typeof userId === 'number') return String(userId);
    unauthorized();
  },
);

export const LegacyJwtEmail = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<LegacyRequest>();
    const payloadFromGuard = request.legacyJwtPayload;

    let payload = payloadFromGuard ?? null;
    if (!payload) {
      let token: string | null = null;
      try {
        token = extractLegacyBearerToken(
          request.headers as Record<string, unknown>,
        );
      } catch {
        unauthorized();
      }

      if (!token) {
        return undefined;
      }

      payload = verifyAndDecodeLegacyJwtPayload(token);
      if (!payload) {
        unauthorized();
      }
    }

    const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
    return email || undefined;
  },
);
