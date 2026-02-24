import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  extractLegacyBearerToken,
  verifyAndDecodeLegacyJwtPayload,
} from '../legacy-auth.util';

@Injectable()
export class LegacyJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = this.decodePayload(request);
    if (!payload) {
      this.unauthorized();
    }

    (
      request as Request & { legacyJwtPayload?: Record<string, unknown> }
    ).legacyJwtPayload = payload;
    return true;
  }

  protected decodePayload(request: Request): Record<string, unknown> | null {
    try {
      const token = extractLegacyBearerToken(
        request.headers as Record<string, unknown>,
      );
      if (!token) return null;
      return verifyAndDecodeLegacyJwtPayload(token);
    } catch {
      return null;
    }
  }

  protected unauthorized(): never {
    throw new HttpException(
      {
        success: false,
        message: 'ERROR: Not authorised',
        statusCode: '401',
      },
      401,
    );
  }
}
