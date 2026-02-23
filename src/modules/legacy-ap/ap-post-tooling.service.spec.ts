import { ApPostToolingService } from './ap-post-tooling.service';

describe('ApPostToolingService', () => {
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
            car_detail_post_car_detail_idTocar_detail: null,
            car_detail_car_detail_post_idTopost: [
              {
                make: 'BMW',
                model: 'X5',
                variant: 'xDrive',
                registration: '2017',
                price: 10000,
                mileage: 120000,
                fuelType: 'diesel',
                engineSize: '2.0',
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

    const service = new ApPostToolingService(prisma, {} as any);
    const response = await service.getPostsByIds('1');
    const row = (response.result as Array<Record<string, unknown>>)[0];

    expect(row).toMatchObject({
      id: '1',
      caption: 'Hello',
      make: 'BMW',
      model: 'X5',
      registration: '2017',
      engineSize: '2.0',
      vendorId: '2',
      accountName: 'vendor.a',
      revalidate: false,
    });
    expect(row.details).toBeUndefined();
    expect(row.car_detail_car_detail_post_idTopost).toBeUndefined();
  });

  it('calculates minPrice/maxPrice from similar posts', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { price: 8000 },
        { price: 10000 },
        { price: 12000 },
      ]),
    } as any;

    const service = new ApPostToolingService(prisma, {} as any);
    const result = await (service as any).calculateSearchPriceRange({
      make: 'Audi',
      model: 'A4',
      variant: null,
      registration: '2018',
      fuelType: 'diesel',
      bodyType: 'Sedan',
      price: 9000,
    });

    expect(result).toEqual({ minPrice: 8000, maxPrice: 12000 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps unknown maxPrice when all similar prices are equal and current price is lower', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { price: 10000 },
        { price: 10000 },
        { price: 10000 },
      ]),
    } as any;

    const service = new ApPostToolingService(prisma, {} as any);
    const result = await (service as any).calculateSearchPriceRange({
      make: 'Audi',
      model: 'A4',
      variant: null,
      registration: '2018',
      fuelType: 'diesel',
      bodyType: 'Sedan',
      price: 9000,
    });

    expect(result).toEqual({ minPrice: 9000, maxPrice: null });
  });

  it('updates renewTo and renewedTime', async () => {
    const prisma = {
      post: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      search: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;

    const service = new ApPostToolingService(prisma, {} as any);
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
