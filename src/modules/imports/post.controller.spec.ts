import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { BadRequestException } from '@nestjs/common';
import { ImportJobsService } from './queue/import-jobs.service';
import { PostImportService } from './services/post-import.service';
import { PrismaService } from '../../database/prisma.service';

describe('PostController - incrementPostMetric', () => {
  let controller: PostController;
  let importJobsService: ImportJobsService;

  beforeEach(async () => {
    const mockImportJobsService = {
      enqueuePostMetricIncrement: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        { provide: ImportJobsService, useValue: mockImportJobsService },
        { provide: PostImportService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PostController>(PostController);
    importJobsService = module.get<ImportJobsService>(ImportJobsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw BadRequestException for invalid metric', async () => {
    const response = {} as any;
    await expect(
      controller.incrementPostMetric(
        '123',
        'invalid',
        response,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid post ID', async () => {
    const response = {} as any;
    await expect(
      controller.incrementPostMetric(
        'not-a-number',
        'postOpen',
        response,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid contact method when metric is contact', async () => {
    const response = {} as any;
    await expect(
      controller.incrementPostMetric(
        '123',
        'contact',
        response,
        undefined,
        'sms',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  describe('supported metrics', () => {
    it('should accept postOpen metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.incrementPostMetric(
        '123',
        'postOpen',
        mockResponse,
        undefined,
        undefined,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept impressions metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.incrementPostMetric(
        '456',
        'impressions',
        mockResponse,
        'visitor-123',
        undefined,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept reach metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.incrementPostMetric(
        '789',
        'reach',
        mockResponse,
        undefined,
        undefined,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept clicks metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.incrementPostMetric(
        '111',
        'clicks',
        mockResponse,
        undefined,
        undefined,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept contact metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.incrementPostMetric(
        '222',
        'contact',
        mockResponse,
        undefined,
        'call',
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });
});
