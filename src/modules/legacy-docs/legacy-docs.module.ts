import { Module } from '@nestjs/common';
import { LegacyDocsController } from './legacy-docs.controller';
import { LegacyDocsService } from './legacy-docs.service';

@Module({
  controllers: [LegacyDocsController],
  providers: [LegacyDocsService],
})
export class LegacyDocsModule {}
