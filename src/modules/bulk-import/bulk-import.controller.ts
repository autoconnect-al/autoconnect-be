import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Header,
  StreamableFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { BulkImportService } from './bulk-import.service';
import { ExportQueryDto } from './dto/export-query.dto';
import { Readable } from 'stream';

/**
 * Controller for bulk import/export operations
 * Provides CSV-based functionality to help admins populate car details
 */
@ApiTags('Bulk Import')
@Controller('bulk-import')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class BulkImportController {
  private readonly logger = new Logger(BulkImportController.name);

  constructor(private readonly bulkImportService: BulkImportService) {}

  /**
   * Export posts and car details as CSV
   * Fetches posts that need details to be filled
   */
  @Get('export')
  @ApiOperation({
    summary: 'Export posts and car details as CSV',
    description:
      'Exports posts with their associated car details in CSV format. ' +
      'Useful for preparing data to be filled by AI or manual editing. ' +
      'Maximum limit is 100 rows.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of rows to export (1-100)',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file successfully generated',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="posts-export.csv"')
  async exportCSV(@Query() query: ExportQueryDto): Promise<StreamableFile> {
    this.logger.log(`Exporting CSV with limit: ${query.limit || 100}`);

    const csvContent = await this.bulkImportService.generateCSV(query.limit);
    const buffer = Buffer.from(csvContent, 'utf-8');
    const stream = Readable.from(buffer);

    return new StreamableFile(stream);
  }

  /**
   * Export all matching posts (no limit)
   * USE WITH CAUTION - Can return large files
   */
  @Get('export-all')
  @ApiOperation({
    summary: 'Export all matching posts as CSV',
    description:
      'Exports ALL posts that match the criteria without any limit. ' +
      'WARNING: This can produce very large files and take a long time. ' +
      'Use only when you need the complete dataset.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file successfully generated',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="posts-export-all.csv"')
  async exportAllCSV(): Promise<StreamableFile> {
    this.logger.warn('Exporting ALL posts - this may take a while');

    const csvContent = await this.bulkImportService.generateCSV(999999);
    const buffer = Buffer.from(csvContent, 'utf-8');
    const stream = Readable.from(buffer);

    return new StreamableFile(stream);
  }

  /**
   * Import CSV file and update/create records
   * Processes the uploaded CSV and updates car details
   */
  @Post('import')
  @ApiOperation({
    summary: 'Import CSV file and update/create records',
    description:
      'Uploads a CSV file with car details and updates or creates records in the database. ' +
      'The CSV should follow the same format as the export. ' +
      'Returns a summary of operations performed.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to import',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'CSV successfully imported',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'Bulk import completed successfully',
        },
        summary: {
          type: 'object',
          properties: {
            created: {
              type: 'number',
              example: 10,
            },
            updated: {
              type: 'number',
              example: 40,
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  row: {
                    type: 'number',
                    example: 5,
                  },
                  error: {
                    type: 'string',
                    example: 'Post with ID 123 not found',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid CSV format or no file uploaded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importCSV(@UploadedFile() file: Express.Multer.File): Promise<{
    success: boolean;
    message: string;
    summary: {
      created: number;
      updated: number;
      errors: Array<{ row: number; error: string }>;
    };
  }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }

    this.logger.log(
      `Processing CSV import: ${file.originalname} (${file.size} bytes)`,
    );

    const summary = await this.bulkImportService.processBulkImport(file.buffer);

    const hasErrors = summary.errors.length > 0;
    const message = hasErrors
      ? `Bulk import completed with ${summary.errors.length} error(s)`
      : 'Bulk import completed successfully';

    return {
      success: !hasErrors || summary.created + summary.updated > 0,
      message,
      summary,
    };
  }
}
