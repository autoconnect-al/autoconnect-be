import { LegacyApService } from './legacy-ap.service';

describe('LegacyApService vendor-management surface', () => {
  const createService = (prisma: any = {}) =>
    new LegacyApService(prisma, {} as any, {} as any);

  it('toggles vendor + related posts/details to deleted', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n, deleted: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      post: {
        findMany: jest.fn().mockResolvedValue([{ id: 11n }, { id: 12n }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.toggleVendorDeleted('1');

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.post.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendor_id: 1n },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.car_detail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { post_id: { in: [11n, 12n] } },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
  });

  it('returns error when vendor does not exist', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.toggleVendorDeleted('999');

    expect(response.success).toBe(false);
    expect(response.message).toContain('Could not mark vendor for crawl next');
  });
});
