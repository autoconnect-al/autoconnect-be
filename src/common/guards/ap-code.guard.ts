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
export class ApCodeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = process.env.AP_ADMIN_CODE;

    if (!expected || expected.trim().length === 0) {
      this.unauthorized();
    }

    if (this.hasValidAdminJwt(request)) {
      return true;
    }

    const provided = this.getHeaderCode(request.headers['x-admin-code']);
    if (!provided || provided !== expected) {
      this.unauthorized();
    }

    return true;
  }

  private hasValidAdminJwt(request: Request): boolean {
    try {
      const token = extractLegacyBearerToken(
        request.headers as Record<string, unknown>,
      );
      if (!token) return false;
      const payload = verifyAndDecodeLegacyJwtPayload(token);
      const roles = Array.isArray(payload?.roles)
        ? payload.roles.map((role) => String(role ?? '').toUpperCase())
        : [];
      return roles.includes('ADMIN');
    } catch {
      return false;
    }
  }

  private getHeaderCode(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return '';
  }

  private unauthorized(): never {
    throw new HttpException(
      {
        success: false,
        message: 'Not authorised',
        statusCode: '401',
      },
      401,
    );
  }
}
