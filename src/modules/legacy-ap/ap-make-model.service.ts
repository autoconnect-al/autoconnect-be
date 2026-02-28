import { Injectable } from '@nestjs/common';
import { LegacyDataService } from '../legacy-data/legacy-data.service';

@Injectable()
export class ApMakeModelService {
  constructor(private readonly legacyDataService: LegacyDataService) {}

  async makeModelMakes(type: 'car' | 'motorcycle') {
    return this.legacyDataService.makes(type);
  }

  async makeModelModels(make: string, type: 'car' | 'motorcycle') {
    return this.legacyDataService.models(make, type, true);
  }
}
