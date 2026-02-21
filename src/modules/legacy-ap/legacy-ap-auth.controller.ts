import { Controller, Get, Headers, HttpException } from '@nestjs/common';
import { LegacyApService } from './legacy-ap.service';

@Controller('authentication')
export class LegacyApAuthController {
  constructor(private readonly service: LegacyApService) {}

  @Get('login-with-code')
  async loginWithCode(@Headers('x-admin-code') code?: string) {
    if (!code) {
      throw new HttpException(
        {
          success: false,
          message: 'Admin code was not provided.',
          statusCode: '401',
        },
        401,
      );
    }

    const response = await this.service.loginWithCode(code);
    if (!response.success) {
      throw new HttpException(
        {
          success: false,
          message: response.message,
          statusCode: response.statusCode,
        },
        Number(response.statusCode) || 500,
      );
    }

    return response;
  }
}
