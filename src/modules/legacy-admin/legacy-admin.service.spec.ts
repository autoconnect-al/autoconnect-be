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
        car_detail_car_detail_post_idTopost: [],
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
});
