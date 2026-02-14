import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApCodeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = this.getCode(request.query?.code);
    const expected =
      process.env.CODE ??
      process.env.AP_ADMIN_CODE ??
      process.env.DOCS_ACCESS_CODE ??
      '';

    if (!expected || provided !== expected) {
      throw new HttpException(
        {
          success: false,
          message: 'Not authorised',
          statusCode: '401',
        },
        401,
      );
    }

    return true;
  }

  private getCode(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return '';
  }
}
