import { Controller, Get, HttpException, Query } from '@nestjs/common';
import { LegacyApService } from './legacy-ap.service';

@Controller('authentication')
export class LegacyApAuthController {
  constructor(private readonly service: LegacyApService) {}

  @Get('login-with-code')
  async loginWithCode(@Query('code') code?: string) {
    if (!code) {
      throw new HttpException(
        {
          success: false,
          message: 'Code was not provided.',
          statusCode: '500',
        },
        500,
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
