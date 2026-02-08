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
});
