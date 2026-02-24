import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
} from '@nestjs/common';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import type { LegacyResponse } from '../../common/legacy-response';
import { PayPalWebhookService } from './paypal-webhook.service';

@Controller('api/v1/orders')
export class LegacyPaymentsController {
  constructor(
    private readonly localPostOrderService: LocalPostOrderService,
    private readonly payPalWebhookService: PayPalWebhookService,
  ) {}

  private throwLegacy(response: LegacyResponse) {
    throw new HttpException(
      {
        success: false,
        message: response.message,
        statusCode: response.statusCode,
      },
      Number(response.statusCode) || 500,
    );
  }

  @Post()
  @HttpCode(200)
  async createOrder(@Body() body: unknown) {
    const response = await this.localPostOrderService.createOrder(body);
    if (
      response &&
      typeof response === 'object' &&
      'success' in response &&
      !(response as LegacyResponse).success
    ) {
      this.throwLegacy(response as LegacyResponse);
    }
    return response;
  }

  @Post(':orderID/capture')
  @HttpCode(200)
  async captureOrder(
    @Param('orderID') orderID: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const response = await this.localPostOrderService.captureOrder(
      orderID,
      idempotencyKey,
    );
    if (
      response &&
      typeof response === 'object' &&
      'success' in response &&
      !(response as LegacyResponse).success
    ) {
      this.throwLegacy(response as LegacyResponse);
    }
    return response;
  }

  @Post('paypal/webhook')
  @HttpCode(200)
  async paypalWebhook(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: unknown,
  ) {
    const result = await this.payPalWebhookService.verifyAndProcess(headers, body);
    return {
      success: true,
      statusCode: '200',
      message: 'Webhook processed',
      result,
    };
  }
}
