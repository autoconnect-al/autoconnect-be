import { LegacyApService } from './legacy-ap.service';

describe('LegacyApService createdTime conversion', () => {
  const createService = () =>
    new LegacyApService({} as any, {} as any, {} as any, {} as any, {} as any);

  it('accepts unix seconds as string', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('1770995188');
    expect(value).toBe(1770995188n);
  });

  it('accepts unix milliseconds and normalizes to seconds', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('1770995188000');
    expect(value).toBe(1770995188n);
  });

  it('accepts ISO date string and converts to seconds', () => {
    const service = createService();
    const value = (service as any).toNullableBigInt('2026-02-15T13:31:54.903Z');
    expect(value).toBe(1771162314n);
  });

  it('returns null for invalid date/text', () => {
    const service = createService();
    expect((service as any).toNullableBigInt('not-a-date')).toBeNull();
  });

  it('getPostsByIds should return php-like flattened shape', async () => {
    const prisma = {
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            caption: Buffer.from('Hello').toString('base64'),
            cleanedCaption: 'Hello',
            sidecarMedias: '[]',
            createdTime: '1770995188',
            likesCount: 10,
            viewsCount: 20,
            status: 'TO_BE_PUBLISHED',
            origin: 'INSTAGRAM',
            revalidate: false,
            vendor_id: 2n,
            vendor: {
              id: 2n,
              accountName: 'vendor.a',
              profilePicture: 'pic',
              biography: 'bio',
              contact: '{"phone_number":"1"}',
            },
            car_detail_car_detail_post_idTopost: [
              {
                make: 'BMW',
                model: 'X5',
                variant: 'xDrive',
                price: 10000,
                mileage: 120000,
                fuelType: 'diesel',
                sold: false,
                contact: '{"phone_number":"1"}',
                transmission: 'automatic',
                drivetrain: 'AWD',
                seats: 5,
                numberOfDoors: 5,
                bodyType: 'SUV',
                customsPaid: true,
                type: 'car',
                priceVerified: false,
                mileageVerified: false,
                fuelVerified: false,
              },
            ],
          },
        ]),
      },
    } as any;

    const service = new LegacyApService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const response = await service.getPostsByIds('1');
    const row = (response.result as Array<Record<string, unknown>>)[0];
    expect(row).toMatchObject({
      id: '1',
      caption: 'Hello',
      make: 'BMW',
      model: 'X5',
      vendorId: '2',
      accountName: 'vendor.a',
      revalidate: false,
    });
    expect(row.details).toBeUndefined();
    expect(row.car_detail_car_detail_post_idTopost).toBeUndefined();
  });
});

describe('LegacyApService.importPromptResults promotion guards', () => {
  it('does not update promotion fields from car-details import payload', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          make: 'BMW',
          model: 'X5',
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
          sold: false,
          customsPaid: false,
          contact: null,
          type: 'car',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new LegacyApService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          make: 'BMW',
          model: 'X5',
          renewTo: 1,
          highlightedTo: 2,
          promotionTo: 3,
          mostWantedTo: 4,
        },
      ]),
    );

    expect(prisma.post.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.post.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('renewTo');
    expect(updateArg.data).not.toHaveProperty('highlightedTo');
    expect(updateArg.data).not.toHaveProperty('promotionTo');
    expect(updateArg.data).not.toHaveProperty('mostWantedTo');
    expect(updateArg.data).toMatchObject({
      live: true,
      revalidate: false,
    });
  });
});

describe('LegacyApService.autoRenewPosts allowed promotion writes', () => {
  it('updates renewTo and renewedTime', async () => {
    const prisma = {
      post: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = new LegacyApService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service as any, 'rebuildSearchFromPosts')
      .mockResolvedValue(undefined);

    const response = await service.autoRenewPosts();

    expect(response.success).toBe(true);
    expect(prisma.post.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          renewTo: expect.any(Number),
          renewedTime: expect.any(Number),
        }),
      }),
    );
  });
});

describe('LegacyApService admin role management', () => {
  it('grants ADMIN role to existing user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, deleted: false }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 9 }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    } as any;

    const service = new LegacyApService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const response = await service.grantAdminRole('7');

    expect(response.success).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)',
      7n,
      9,
    );
  });

  it('prevents revoking the last ADMIN role', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, deleted: false }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 9 }),
      },
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ total: 1n }])
        .mockResolvedValueOnce([{ total: 1n }]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    } as any;

    const service = new LegacyApService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const response = await service.revokeAdminRole('7');

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe('409');
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
