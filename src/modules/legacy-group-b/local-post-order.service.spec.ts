import { LocalPostOrderService } from './local-post-order.service';

describe('LocalPostOrderService.markAsDeleted', () => {
  it('marks post and car_detail rows as deleted', async () => {
    const prisma = {
      post: {
        findFirst: jest.fn().mockResolvedValue({ id: 100n }),
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      search: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = new LocalPostOrderService(prisma, {} as any);
    const response = await service.markAsDeleted('100', '200');

    expect(response.success).toBe(true);
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.car_detail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ post_id: 100n }, { id: 100n }] },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.search.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({ deleted: '1' }),
      }),
    );
  });
});

describe('LocalPostOrderService.captureOrder promotion writes', () => {
  it('updates promotion windows for package 1113', async () => {
    const prisma = {
      customer_orders: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          paypalId: 'LOCAL-1',
          postId: '100',
          packages: '1113',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      post: {
        findUnique: jest.fn().mockResolvedValue({ id: 100n }),
        update: jest.fn().mockResolvedValue({}),
      },
      search: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = new LocalPostOrderService(prisma, {} as any);
    const response = await service.captureOrder('LOCAL-1');

    expect((response as any).status).toBe('COMPLETED');
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({
          promotionTo: expect.any(Number),
        }),
      }),
    );
  });
});
