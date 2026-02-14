import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Query,
} from '@nestjs/common';
import { LegacyAuthService } from './legacy-auth.service';
import type { LegacyResponse } from '../../common/legacy-response';

@Controller()
export class LegacyAuthController {
  constructor(private readonly service: LegacyAuthService) {}

  private log(event: string, payload: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        scope: 'auth-controller',
        event,
        ...payload,
      }),
    );
  }

  private throwLegacy(response: LegacyResponse, httpStatus: number) {
    throw new HttpException(
      {
        success: false,
        message: response.message,
        statusCode: response.statusCode,
      },
      httpStatus,
    );
  }

  @Post('authentication/login')
  @HttpCode(200)
  async authenticationLogin(@Body() body: unknown) {
    const payload = (body ?? {}) as Record<string, unknown>;
    this.log('login.request', {
      endpoint: 'authentication/login',
      hasUsername: typeof payload.username === 'string',
      hasEmail: typeof payload.email === 'string',
      hasPassword: typeof payload.password === 'string',
    });
    if (
      typeof payload.username !== 'string' ||
      typeof payload.password !== 'string'
    ) {
      this.log('login.invalid_payload', {
        endpoint: 'authentication/login',
      });
      const response = this.service.loginNotImplemented();
      this.throwLegacy(response, 500);
    }
    const response = await this.service.loginLocal(body);
    this.log('login.response', {
      endpoint: 'authentication/login',
      success: response.success,
      statusCode: response.statusCode,
      message: response.message,
    });
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Post('user/login')
  @HttpCode(200)
  async userLogin(@Body() body: unknown) {
    const payload = (body ?? {}) as Record<string, unknown>;
    this.log('login.request', {
      endpoint: 'user/login',
      hasUsername: typeof payload.username === 'string',
      hasEmail: typeof payload.email === 'string',
      hasPassword: typeof payload.password === 'string',
    });
    if (
      typeof payload.username !== 'string' ||
      typeof payload.password !== 'string'
    ) {
      this.log('login.invalid_payload', {
        endpoint: 'user/login',
      });
      const response = this.service.loginNotImplemented();
      this.throwLegacy(response, 500);
    }
    const response = await this.service.loginLocal(body);
    this.log('login.response', {
      endpoint: 'user/login',
      success: response.success,
      statusCode: response.statusCode,
      message: response.message,
    });
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Post('user/create-user')
  @HttpCode(200)
  async createUser(@Body() body: unknown) {
    const response = await this.service.createUserLocal(body);
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Get('user/refresh-token')
  async refreshToken(@Headers() headers: Record<string, unknown>) {
    const response = await this.service.refreshTokenLocal(headers);
    if (!response.success) {
      this.throwLegacy(response, 401);
    }
    return response;
  }

  @Post('user/reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: unknown) {
    const response = await this.service.resetPasswordLocal(body);
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Post('user/verify-password')
  @HttpCode(200)
  async verifyPassword(@Body() body: unknown) {
    const response = await this.service.verifyPasswordLocal(body);
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Get('instagram-sync/get-access-token')
  instagramToken(@Query('code') code?: string) {
    return this.service.getInstagramAccessToken(code);
  }
}
