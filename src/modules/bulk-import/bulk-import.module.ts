import { Module } from '@nestjs/common';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';
import { DatabaseModule } from '../../database/database.module';

/**
 * Module for bulk import/export functionality
 * Provides CSV-based operations to help admins populate car details
 */
@Module({
  imports: [DatabaseModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
