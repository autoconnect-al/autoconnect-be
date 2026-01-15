import { Controller, Get, Query } from '@nestjs/common';
import { MakeModelService } from './make-model.service';

@Controller({
  path: 'make-model',
  version: '1',
})
export class MakeModelController {
  constructor(private readonly makeModelService: MakeModelService) {}

  @Get('makes')
  async getMakes(@Query('type') type: string = 'car') {
    return this.makeModelService.getMakes(type);
  }

  @Get('models')
  async getModels(
    @Query('make') make: string,
    @Query('type') type: string = 'car',
  ) {
    if (!make) throw new Error('Make is required');
    return this.makeModelService.getModels(make, type);
  }
}
