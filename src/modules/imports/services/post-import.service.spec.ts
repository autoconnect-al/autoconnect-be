import { PostImportService } from './post-import.service';
import { PrismaService } from '../../../database/prisma.service';

class MockPrismaService {
  $executeRawUnsafe = jest.fn();
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
        clicks: {
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

  it('should increment reach only once for a unique visitor on impression', async () => {
    const postId = 789n;
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.post.update.mockResolvedValue({ id: postId });

    await service.incrementPostMetric(postId, 'impressions', {
      visitorId: 'visitor-1',
    });

    expect(prisma.post.update).toHaveBeenNthCalledWith(1, {
      where: { id: postId },
      data: {
        impressions: {
          increment: 1,
        },
      },
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.post.update).toHaveBeenNthCalledWith(2, {
      where: { id: postId },
      data: {
        reach: {
          increment: 1,
        },
      },
    });
  });

  it('should not increment reach when visitor was already counted for the post', async () => {
    const postId = 790n;
    prisma.$executeRawUnsafe.mockResolvedValue(0);
    prisma.post.update.mockResolvedValue({ id: postId });

    await service.incrementPostMetric(postId, 'impressions', {
      visitorId: 'visitor-1',
    });

    expect(prisma.post.update).toHaveBeenCalledTimes(1);
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        impressions: {
          increment: 1,
        },
      },
    });
  });

  it('should increment clicks metric', async () => {
    const postId = 111n;
    prisma.post.update.mockResolvedValue({
      id: postId,
      clicks: 3,
    });

    await service.incrementPostMetric(postId, 'clicks');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        clicks: {
          increment: 1,
        },
      },
    });
  });

  it('should increment contact metric', async () => {
    const postId = 222n;
    prisma.post.update.mockResolvedValue({
      id: postId,
      contact: 2,
    });

    await service.incrementPostMetric(postId, 'contact', {
      contactMethod: 'call',
    });

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        contact: {
          increment: 1,
        },
        contactCall: {
          increment: 1,
        },
      },
    });
  });

  it('should increment contact metric without method breakdown when method is omitted', async () => {
    const postId = 223n;
    prisma.post.update.mockResolvedValue({
      id: postId,
      contact: 1,
    });

    await service.incrementPostMetric(postId, 'contact');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        contact: {
          increment: 1,
        },
      },
    });
  });

  it('should increment legacy reach metric', async () => {
    const postId = 224n;
    prisma.post.update.mockResolvedValue({ id: postId, reach: 5 });

    await service.incrementPostMetric(postId, 'reach');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: {
        reach: {
          increment: 1,
        },
      },
    });
  });

  it('should throw error for invalid contact method', async () => {
    const postId = 225n;

    await expect(
      service.incrementPostMetric(postId, 'contact', {
        contactMethod: 'sms' as any,
      }),
    ).rejects.toThrow('Invalid contact method');
  });

  it('should throw error for invalid metric', async () => {
    const postId = 123n;

    await expect(
      service.incrementPostMetric(postId, 'invalid' as any),
    ).rejects.toThrow('Invalid metric: invalid');
  });
});

describe('PostImportService.importResult promotion guards', () => {
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

  it('does not update promotion fields from AI import payload', async () => {
    const postId = 123n;
    prisma.car_detail.findFirst.mockResolvedValue({
      id: 777n,
      post_id: postId,
      model: 'X5',
      make: 'BMW',
      variant: null,
      registration: null,
      mileage: null,
      transmission: null,
      fuelType: null,
      engineSize: null,
      drivetrain: null,
      seats: null,
      numberOfDoors: null,
      bodyType: null,
      price: null,
      emissionGroup: null,
      sold: false,
      customsPaid: false,
      contact: null,
      type: 'car',
      priceVerified: false,
      mileageVerified: false,
    });
    prisma.car_detail.update.mockResolvedValue({});
    prisma.post.findUnique.mockResolvedValue({
      id: postId,
      status: 'TO_BE_PUBLISHED',
      origin: 'INSTAGRAM',
      renewTo: 1700000000,
      highlightedTo: 1700000001,
      promotionTo: 1700000002,
      mostWantedTo: 1700000003,
    });
    prisma.post.update.mockResolvedValue({});

    const response = await service.importResult(
      JSON.stringify([
        {
          id: '123',
          make: 'BMW',
          model: 'X5',
          renewTo: 1,
          highlightedTo: 2,
          promotionTo: 3,
          mostWantedTo: 4,
        },
      ]),
    );

    expect(response.success).toBe(true);
    expect(prisma.post.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.post.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('renewTo');
    expect(updateArg.data).not.toHaveProperty('highlightedTo');
    expect(updateArg.data).not.toHaveProperty('promotionTo');
    expect(updateArg.data).not.toHaveProperty('mostWantedTo');
    expect(updateArg.data).toMatchObject({
      status: 'TO_BE_PUBLISHED',
      origin: 'INSTAGRAM',
      live: true,
      revalidate: false,
    });
  });
});
