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
    const tx = {
      customer_orders: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      search: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      customer_orders: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          paypalId: 'LOCAL-1',
          postId: '100',
          packages: '1113',
          status: 'CREATED',
        }),
      },
      post: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 100n, vendor_id: 200n, deleted: false }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(tx)),
    } as any;

    const service = new LocalPostOrderService(prisma, {} as any);
    const response = await service.captureOrder('LOCAL-1');

    expect((response as any).status).toBe('COMPLETED');
    expect(tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({
          promotionTo: expect.any(Number),
        }),
      }),
    );
  });

  it('is idempotent when order is already completed', async () => {
    const prisma = {
      customer_orders: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          paypalId: 'LOCAL-1',
          postId: '100',
          packages: '1113',
          status: 'COMPLETED',
        }),
      },
      post: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 100n, vendor_id: 200n, deleted: false }),
      },
      $transaction: jest.fn(),
    } as any;

    const service = new LocalPostOrderService(prisma, {} as any);
    const response = await service.captureOrder('LOCAL-1');

    expect((response as any).status).toBe('COMPLETED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
