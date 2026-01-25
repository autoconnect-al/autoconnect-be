import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the API',
  })
  @ApiOkResponse({
    description: 'API is healthy',
    schema: {
      example: { status: 'ok' },
    },
  })
  check() {
    return { status: 'ok' };
  }
}
