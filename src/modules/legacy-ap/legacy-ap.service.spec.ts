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
