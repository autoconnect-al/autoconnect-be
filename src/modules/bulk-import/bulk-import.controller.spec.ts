import { Test, TestingModule } from '@nestjs/testing';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';
import { BadRequestException } from '@nestjs/common';

describe('BulkImportController', () => {
  let controller: BulkImportController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let service: BulkImportService;

  const mockBulkImportService = {
    generateCSV: jest.fn(),
    generatePublishedPostsCSV: jest.fn(),
    processBulkImport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkImportController],
      providers: [
        {
          provide: BulkImportService,
          useValue: mockBulkImportService,
        },
      ],
    }).compile();

    controller = module.get<BulkImportController>(BulkImportController);
    service = module.get<BulkImportService>(BulkImportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('exportCSV', () => {
    it('should export CSV with default limit', async () => {
      const mockCSV = 'post_id,cd_make\n1,Toyota\n';
      mockBulkImportService.generateCSV.mockResolvedValue(mockCSV);

      const result = await controller.exportCSV({ limit: 100 });

      expect(result).toBeDefined();
      expect(mockBulkImportService.generateCSV).toHaveBeenCalledWith(100);
    });

    it('should export CSV with custom limit', async () => {
      const mockCSV = 'post_id,cd_make\n1,Toyota\n';
      mockBulkImportService.generateCSV.mockResolvedValue(mockCSV);

      const result = await controller.exportCSV({ limit: 50 });

      expect(result).toBeDefined();
      expect(mockBulkImportService.generateCSV).toHaveBeenCalledWith(50);
    });
  });

  describe('exportAllCSV', () => {
    it('should export all matching posts', async () => {
      const mockCSV = 'post_id,cd_make\n1,Toyota\n2,Honda\n';
      mockBulkImportService.generateCSV.mockResolvedValue(mockCSV);

      const result = await controller.exportAllCSV();

      expect(result).toBeDefined();
      expect(mockBulkImportService.generateCSV).toHaveBeenCalledWith(999999);
    });
  });

  describe('exportPublishedPostsCSV', () => {
    it('should export published posts with default limit', async () => {
      const mockCSV = 'post_id,cd_make,cd_model\n1,Toyota,Camry\n';
      mockBulkImportService.generatePublishedPostsCSV.mockResolvedValue(
        mockCSV,
      );

      const result = await controller.exportPublishedPostsCSV({ limit: 100 });

      expect(result).toBeDefined();
      expect(
        mockBulkImportService.generatePublishedPostsCSV,
      ).toHaveBeenCalledWith(100);
    });

    it('should export published posts with custom limit', async () => {
      const mockCSV = 'post_id,cd_make,cd_model\n1,Toyota,Camry\n';
      mockBulkImportService.generatePublishedPostsCSV.mockResolvedValue(
        mockCSV,
      );

      const result = await controller.exportPublishedPostsCSV({ limit: 50 });

      expect(result).toBeDefined();
      expect(
        mockBulkImportService.generatePublishedPostsCSV,
      ).toHaveBeenCalledWith(50);
    });
  });

  describe('importCSV', () => {
    const mockFile = {
      originalname: 'test.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('post_id,cd_make\n1,Toyota\n'),
      size: 100,
    } as Express.Multer.File;

    it('should import CSV and return success summary', async () => {
      const mockSummary = {
        created: 5,
        updated: 10,
        errors: [],
      };

      mockBulkImportService.processBulkImport.mockResolvedValue(mockSummary);

      const result = await controller.importCSV(mockFile);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Bulk import completed successfully');
      expect(result.summary).toEqual(mockSummary);
      expect(mockBulkImportService.processBulkImport).toHaveBeenCalledWith(
        mockFile.buffer,
      );
    });

    it('should handle errors in import', async () => {
      const mockSummary = {
        created: 5,
        updated: 10,
        errors: [{ row: 3, error: 'Invalid data' }],
      };

      mockBulkImportService.processBulkImport.mockResolvedValue(mockSummary);

      const result = await controller.importCSV(mockFile);

      expect(result.success).toBe(true); // Still successful if some rows processed
      expect(result.message).toContain('error(s)');
      expect(result.summary.errors).toHaveLength(1);
    });

    it('should throw BadRequestException if no file uploaded', async () => {
      await expect(controller.importCSV(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file is not CSV', async () => {
      const nonCsvFile = {
        ...mockFile,
        mimetype: 'application/json',
        originalname: 'test.json',
      } as Express.Multer.File;

      await expect(controller.importCSV(nonCsvFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept CSV file with .csv extension even if mimetype differs', async () => {
      const csvFileWithDifferentMime = {
        ...mockFile,
        mimetype: 'application/octet-stream',
        originalname: 'test.csv',
      } as Express.Multer.File;

      const mockSummary = {
        created: 1,
        updated: 0,
        errors: [],
      };

      mockBulkImportService.processBulkImport.mockResolvedValue(mockSummary);

      const result = await controller.importCSV(csvFileWithDifferentMime);

      expect(result.success).toBe(true);
    });
  });
});
