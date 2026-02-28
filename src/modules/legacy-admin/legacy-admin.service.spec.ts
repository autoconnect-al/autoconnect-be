import { LegacyAdminService } from './legacy-admin.service';

describe('LegacyAdminService', () => {
  const makeService = () => {
    const prisma = {
      post: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    } as any;

    const service = new LegacyAdminService(prisma, {} as any, {} as any);
    return { service, prisma };
  };

  it('getPosts should include status and decode caption from base64', async () => {
    const { service, prisma } = makeService();
    prisma.post.findMany.mockResolvedValue([
      {
        id: 123n,
        vendor_id: 10n,
        caption: 'SGVsbG8gd29ybGQ=',
        deleted: false,
        status: 'DRAFT',
        vendor: {
          accountName: 'vendor-10',
          profilePicture: null,
          contact: null,
        },
        car_detail_post_car_detail_idTocar_detail: null,
        car_detail_car_detail_post_idTopost: [{ deleted: false }],
      },
    ]);

    const response = await service.getPosts('10');

    expect(response.success).toBe(true);
    expect(response.result).toEqual([
      expect.objectContaining({
        id: '123',
        vendorId: '10',
        caption: 'Hello world',
        status: 'DRAFT',
      }),
    ]);
  });

  it('getPostById should include status, decode caption, and use car_detail registration', async () => {
    const { service, prisma } = makeService();
    prisma.post.findFirst.mockResolvedValue({
      id: 555n,
      vendor_id: 10n,
      caption: 'VGVzdCBjYXB0aW9u',
      deleted: false,
      status: 'PUBLISHED',
      vendor: {
        accountName: 'vendor-10',
        profilePicture: null,
        contact: null,
      },
      car_detail_post_car_detail_idTocar_detail: {
        registration: '2026',
        deleted: false,
      },
      car_detail_car_detail_post_idTopost: [],
    });

    const response = await service.getPostById('555', '10');

    expect(response.success).toBe(true);
    expect(response.result).toEqual(
      expect.objectContaining({
        id: '555',
        caption: 'Test caption',
        status: 'PUBLISHED',
        registration: '2026',
      }),
    );
  });

  it('getPostById should return null when car_detail is deleted', async () => {
    const { service, prisma } = makeService();
    prisma.post.findFirst.mockResolvedValue({
      id: 555n,
      vendor_id: 10n,
      caption: 'VGVzdA==',
      deleted: false,
      vendor: null,
      car_detail_post_car_detail_idTocar_detail: {
        deleted: true,
      },
      car_detail_car_detail_post_idTopost: [],
    });

    const response = await service.getPostById('555', '10');

    expect(response.success).toBe(true);
    expect(response.result).toBeNull();
  });

  it('getPosts should skip rows when either post or car_detail is deleted', async () => {
    const { service, prisma } = makeService();
    prisma.post.findMany.mockResolvedValue([
      {
        id: 1n,
        vendor_id: 10n,
        caption: 'QQ==',
        deleted: false,
        status: 'PUBLISHED',
        vendor: null,
        car_detail_post_car_detail_idTocar_detail: { deleted: false },
        car_detail_car_detail_post_idTopost: [],
      },
      {
        id: 2n,
        vendor_id: 10n,
        caption: 'Qg==',
        deleted: false,
        status: 'PUBLISHED',
        vendor: null,
        car_detail_post_car_detail_idTocar_detail: { deleted: true },
        car_detail_car_detail_post_idTopost: [],
      },
      {
        id: 3n,
        vendor_id: 10n,
        caption: 'Qw==',
        deleted: true,
        status: 'PUBLISHED',
        vendor: null,
        car_detail_post_car_detail_idTocar_detail: { deleted: false },
        car_detail_car_detail_post_idTopost: [],
      },
    ]);

    const response = await service.getPosts('10');

    expect(response.success).toBe(true);
    expect(response.result).toHaveLength(1);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: '1',
      }),
    );
  });
});
