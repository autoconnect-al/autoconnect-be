import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle, seconds } from '@nestjs/throttler';
import { LegacyAuthService } from './legacy-auth.service';
import type { LegacyResponse } from '../../common/legacy-response';
import { legacyError } from '../../common/legacy-response';
import { createLogger } from '../../common/logger.util';
import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard';

@Controller()
export class LegacyAuthController {
  private readonly logger = createLogger('auth-controller');

  constructor(private readonly service: LegacyAuthService) {}

  private log(event: string, payload: Record<string, unknown>) {
    this.logger.info(event, payload);
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
  @UseInterceptors(AnyFilesInterceptor())
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async authenticationLogin(
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ) {
    return this.handleLoginEndpoint('authentication/login', body, contentType);
  }

  @Post('user/login')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async userLogin(
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ) {
    return this.handleLoginEndpoint('user/login', body, contentType);
  }

  private async handleLoginEndpoint(
    endpoint: 'authentication/login' | 'user/login',
    body: unknown,
    contentType?: string,
  ) {
    const payload = (body ?? {}) as Record<string, unknown>;
    const hasUsername = typeof payload.username === 'string';
    const hasEmail = typeof payload.email === 'string';
    const hasPassword = typeof payload.password === 'string';
    this.log('login.request', {
      endpoint,
      contentType: contentType ?? '',
      hasUsername,
      hasEmail,
      hasPassword,
    });
    if ((!hasUsername && !hasEmail) || !hasPassword) {
      this.log('login.invalid_payload', {
        endpoint,
      });
      const response = legacyError(
        'Could not login user. Please check your credentials.',
        400,
      );
      this.throwLegacy(response, 400);
    }
    const response = await this.service.loginLocal(body);
    this.log('login.response', {
      endpoint,
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
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async resetPassword(@Body() body: unknown) {
    const response = await this.service.resetPasswordLocal(body);
    if (!response.success) {
      this.throwLegacy(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  @Post('user/verify-password')
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
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
