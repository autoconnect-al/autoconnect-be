import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Admin guard that ensures only admin users can access protected routes
 * For now, checks for a special admin code in query params or JWT authentication
 * TODO: Update to use proper role-based access when roles are added to JWT
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminCode =
    process.env.ADMIN_CODE || 'ejkuU89EcU6LinIHVUvhpQz65gY8DOgG';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Check for admin code in query params (legacy compatibility)
    const code = request.query.code as string | undefined;
    if (code && code === this.adminCode) {
      return true;
    }

    // Check for JWT authentication (future implementation)
    // For now, if no code is provided, deny access
    throw new UnauthorizedException('Admin access required');
  }
}
