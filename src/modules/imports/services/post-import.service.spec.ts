import { PostImportService } from './post-import.service';
import { PrismaService } from '../../../database/prisma.service';

class MockPrismaService {
  post = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };
  car_detail = {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  vendor = {
    findUnique: jest.fn(),
    create: jest.fn(),
  };
}

class MockOpenAIService {}
class MockImageDownloadService {}

describe('PostImportService.importPost', () => {
  let service: PostImportService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = new MockPrismaService();
    service = new PostImportService(
      prisma as unknown as PrismaService,
      new MockOpenAIService() as any,
      new MockImageDownloadService() as any,
    );
  });

  it('sets car_detail.post_id for new Instagram post with created car_detail', async () => {
    const postId = 123n;
    const vendorId = 1;

    prisma.post.findUnique.mockResolvedValue(null);
    prisma.vendor.findUnique.mockResolvedValue({ id: 1n });

    // car_detail.create returns carDetail id (we use postId as id in service)
    prisma.car_detail.create.mockResolvedValue({ id: postId });

    prisma.post.upsert.mockResolvedValue({ id: postId });

    const result = await service.importPost(
      {
        id: postId.toString(),
        caption: 'Test',
        origin: 'INSTAGRAM',
        sidecarMedias: [],
      },
      vendorId,
      false,
      false,
    );

    expect(result).toBe(postId);
    // When new car_detail is created, updateMany should still be called to backfill if needed
    expect(prisma.car_detail.updateMany).toHaveBeenCalledWith({
      where: {
        id: postId,
        OR: [{ post_id: null }, { post_id: { not: postId } }],
      },
      data: { post_id: postId },
    });
  });

  it('backfills car_detail.post_id when reusing existing car_detail on existing post', async () => {
    const postId = 456n;
    const carDetailId = 789n;
    const vendorId = 2;

    prisma.post.findUnique.mockResolvedValue({
      id: postId,
      createdTime: new Date().toISOString(),
      vendor_id: 2n,
      deleted: false,
      status: 'DRAFT',
      cleanedCaption: 'caption',
      car_detail_id: carDetailId,
    });

    prisma.vendor.findUnique.mockResolvedValue({ id: 2n });

    prisma.post.upsert.mockResolvedValue({ id: postId });

    const result = await service.importPost(
      {
        id: postId.toString(),
        caption: 'Existing',
        origin: 'INSTAGRAM',
        sidecarMedias: [],
      },
      vendorId,
      false,
      false,
    );

    expect(result).toBe(postId);
    // Verify backfill called with existing carDetailId
    expect(prisma.car_detail.updateMany).toHaveBeenCalledWith({
      where: {
        id: carDetailId,
        OR: [{ post_id: null }, { post_id: { not: postId } }],
      },
      data: { post_id: postId },
    });
  });
});

describe('PostImportService.incrementPostMetric', () => {
  let service: PostImportService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = new MockPrismaService();
    service = new PostImportService(
      prisma as unknown as PrismaService,
      new MockOpenAIService() as any,
      new MockImageDownloadService() as any,
    );
  });

  it('should increment postOpen metric', async () => {
    const postId = 123n;
    prisma.post.update.mockResolvedValue({
      id: postId,
      postOpen: 1,
    });

    await service.incrementPostMetric(postId, 'postOpen');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        postOpen: {
          increment: 1,
        },
      },
    });
  });

  it('should increment impressions metric', async () => {
    const postId = 456n;
    prisma.post.update.mockResolvedValue({
      id: postId,
      impressions: 5,
    });

    await service.incrementPostMetric(postId, 'impressions');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        impressions: {
          increment: 1,
        },
      },
    });
  });

  it('should throw error for invalid metric', async () => {
    const postId = 123n;

    await expect(
      service.incrementPostMetric(postId, 'invalid' as any),
    ).rejects.toThrow('Invalid metric: invalid');
  });
});
