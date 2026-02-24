import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  extractLegacyBearerToken,
  verifyAndDecodeLegacyJwtPayload,
} from '../legacy-auth.util';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const adminCode = process.env.ADMIN_CODE;
    if (!adminCode || adminCode.trim().length === 0) {
      throw new UnauthorizedException('Admin code not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (this.hasValidAdminJwt(request)) {
      return true;
    }

    const code = this.getHeaderCode(request.headers['x-admin-code']);
    if (code && code === adminCode) {
      return true;
    }

    throw new UnauthorizedException('Admin access required');
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
}
