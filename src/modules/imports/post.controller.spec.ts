import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostImportService } from './services/post-import.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('PostController - incrementPostMetric', () => {
  let controller: PostController;
  let postImportService: PostImportService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockPostImportService = {
      incrementPostMetric: jest.fn(),
    };

    const mockPrismaService = {
      post: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        { provide: PostImportService, useValue: mockPostImportService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<PostController>(PostController);
    postImportService = module.get<PostImportService>(PostImportService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw BadRequestException for invalid metric', async () => {
    const response = {} as any;
    await expect(
      controller.incrementPostMetric('123', 'invalid', response),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid post ID', async () => {
    const response = {} as any;
    await expect(
      controller.incrementPostMetric('not-a-number', 'postOpen', response),
    ).rejects.toThrow(BadRequestException);
  });

  describe('supported metrics', () => {
    it('should accept postOpen metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue({
        id: 123n,
      });
      (postImportService.incrementPostMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementPostMetric('123', 'postOpen', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept impressions metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue({
        id: 456n,
      });
      (postImportService.incrementPostMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementPostMetric('456', 'impressions', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept reach metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue({
        id: 789n,
      });
      (postImportService.incrementPostMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementPostMetric('789', 'reach', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept clicks metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue({
        id: 111n,
      });
      (postImportService.incrementPostMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementPostMetric('111', 'clicks', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });

    it('should accept contact metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (prismaService.post.findUnique as jest.Mock).mockResolvedValue({
        id: 222n,
      });
      (postImportService.incrementPostMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementPostMetric('222', 'contact', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });
});
