import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ImportJobsService } from './queue/import-jobs.service';
import { PostImportService } from './services/post-import.service';
import { PrismaService } from '../../database/prisma.service';
import { signPostMetricRequest } from './post-metrics-signature.util';

function buildSignedHeaders(input: {
  postId: string;
  metric: 'postOpen' | 'impressions' | 'reach' | 'clicks' | 'contact';
  visitorId?: string;
  contactMethod?: 'call' | 'whatsapp' | 'email' | 'instagram';
}) {
  const timestamp = Date.now().toString();
  return {
    timestamp,
    signature: signPostMetricRequest({
      timestamp,
      postId: input.postId,
      metric: input.metric,
      visitorId: input.visitorId,
      contactMethod: input.contactMethod,
    }),
  };
}

describe('PostController - incrementPostMetric', () => {
  let controller: PostController;
  let importJobsService: ImportJobsService;

  beforeEach(async () => {
    process.env.POST_METRICS_SIGNING_SECRET =
      'unit-test-post-metrics-signing-secret';

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
        undefined,
        undefined,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw ForbiddenException when signature is missing', async () => {
    const response = {} as any;

    await expect(
      controller.incrementPostMetric(
        '123',
        'clicks',
        response,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('supported metrics', () => {
    it('should accept postOpen metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const headers = buildSignedHeaders({ postId: '123', metric: 'postOpen' });

      await controller.incrementPostMetric(
        '123',
        'postOpen',
        mockResponse,
        undefined,
        undefined,
        headers.timestamp,
        headers.signature,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept impressions metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const headers = buildSignedHeaders({
        postId: '456',
        metric: 'impressions',
        visitorId: 'visitor-123',
      });

      await controller.incrementPostMetric(
        '456',
        'impressions',
        mockResponse,
        'visitor-123',
        undefined,
        headers.timestamp,
        headers.signature,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept reach metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const headers = buildSignedHeaders({ postId: '789', metric: 'reach' });

      await controller.incrementPostMetric(
        '789',
        'reach',
        mockResponse,
        undefined,
        undefined,
        headers.timestamp,
        headers.signature,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept clicks metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const headers = buildSignedHeaders({ postId: '111', metric: 'clicks' });

      await controller.incrementPostMetric(
        '111',
        'clicks',
        mockResponse,
        undefined,
        undefined,
        headers.timestamp,
        headers.signature,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept contact metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      const headers = buildSignedHeaders({
        postId: '222',
        metric: 'contact',
        contactMethod: 'call',
      });

      await controller.incrementPostMetric(
        '222',
        'contact',
        mockResponse,
        undefined,
        'call',
        headers.timestamp,
        headers.signature,
      );

      expect(importJobsService.enqueuePostMetricIncrement).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });
});
