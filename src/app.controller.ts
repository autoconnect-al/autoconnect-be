import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Welcome endpoint',
    description: 'Returns a welcome message from the API',
  })
  @ApiOkResponse({
    description: 'Welcome message',
    schema: {
      example: 'Hello from NestJS API!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
