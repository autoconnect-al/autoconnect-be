import { ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip =
      req.ip ??
      req.headers?.['x-forwarded-for'] ??
      req.socket?.remoteAddress ??
      'unknown';

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const username =
      typeof body.username === 'string'
        ? body.username.trim().toLowerCase()
        : '';
    const identifier = email || username || 'anonymous';

    return `${String(ip)}:${identifier}`;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
      },
      429,
    );
  }
}
