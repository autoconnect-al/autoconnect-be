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

    const paymentProvider = {
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
    } as any;
    const service = new LocalPostOrderService(
      prisma,
      {} as any,
      paymentProvider,
    );
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
          captureKey: null,
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

    const paymentProvider = {
      createOrder: jest.fn().mockResolvedValue({
        id: 'LOCAL-1',
        status: 'CREATED',
        links: [],
      }),
      captureOrder: jest.fn().mockResolvedValue({
        id: 'LOCAL-1',
        status: 'COMPLETED',
      }),
    } as any;
    const service = new LocalPostOrderService(
      prisma,
      {} as any,
      paymentProvider,
    );
    const response = await service.captureOrder('LOCAL-1', 'capture-abc');

    expect((response as any).status).toBe('COMPLETED');
    expect((response as any).captureKey).toBe('capture-abc');
    expect(tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100n },
        data: expect.objectContaining({
          promotionTo: expect.any(Number),
        }),
      }),
    );
    expect(tx.customer_orders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          captureKey: 'capture-abc',
          capturedAt: expect.any(Date),
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
          captureKey: 'capture:LOCAL-1',
        }),
      },
      post: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 100n, vendor_id: 200n, deleted: false }),
      },
      $transaction: jest.fn(),
    } as any;

    const paymentProvider = {
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
    } as any;
    const service = new LocalPostOrderService(
      prisma,
      {} as any,
      paymentProvider,
    );
    const response = await service.captureOrder('LOCAL-1');

    expect((response as any).status).toBe('COMPLETED');
    expect((response as any).captureKey).toBe('capture:LOCAL-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns conflict when status is not an allowed transition state', async () => {
    const prisma = {
      customer_orders: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          paypalId: 'LOCAL-1',
          postId: '100',
          packages: '1113',
          status: 'CANCELLED',
          captureKey: null,
        }),
      },
      post: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 100n, vendor_id: 200n, deleted: false }),
      },
    } as any;

    const paymentProvider = {
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
    } as any;
    const service = new LocalPostOrderService(
      prisma,
      {} as any,
      paymentProvider,
    );
    const response = await service.captureOrder('LOCAL-1');

    expect((response as any).success).toBe(false);
    expect((response as any).statusCode).toBe('409');
  });
});
