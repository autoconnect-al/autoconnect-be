import { ExecutionContext, Injectable } from '@nestjs/common';
import { LegacyJwtGuard } from './legacy-jwt.guard';
import type { Request } from 'express';

@Injectable()
export class LegacyJwtAdminGuard extends LegacyJwtGuard {
  override canActivate(context: ExecutionContext): boolean {
    const allowed = super.canActivate(context);
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest<
      Request & {
        legacyJwtPayload?: Record<string, unknown>;
      }
    >();

    const roles = request.legacyJwtPayload?.roles;
    const roleList = Array.isArray(roles)
      ? roles.map((role) => String(role ?? '').toUpperCase())
      : [];

    if (!roleList.includes('ADMIN')) {
      this.unauthorized();
    }

    return true;
  }
}
