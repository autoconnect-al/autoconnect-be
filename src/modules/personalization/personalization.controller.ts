import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';

@Controller('api/v1/personalization')
export class PersonalizationController {
  constructor(private readonly personalizationService: PersonalizationService) {}

  @Post('reset')
  @HttpCode(200)
  async reset(@Body('visitorId') visitorId?: string) {
    const reset = await this.personalizationService.resetVisitorProfile(visitorId);
    if (!reset) {
      throw new BadRequestException('Invalid visitorId');
    }

    return {
      success: true,
      statusCode: '200',
      message: 'Personalization profile reset',
      result: 'OK',
    };
  }
}
