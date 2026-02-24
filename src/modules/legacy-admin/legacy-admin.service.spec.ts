import { LegacyAdminService } from './legacy-admin.service';

describe('LegacyAdminService', () => {
  const makeService = () => {
    const prisma = {
      search: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      post: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;

    const service = new LegacyAdminService(prisma, {} as any, {} as any);
    return { service, prisma };
  };

  it('getPosts should include status and decode caption from base64', async () => {
    const { service, prisma } = makeService();
    prisma.search.findMany.mockResolvedValue([
      {
        id: 123n,
        vendorId: 10n,
        caption: 'SGVsbG8gd29ybGQ=',
        deleted: '0',
      },
    ]);
    prisma.post.findMany.mockResolvedValue([{ id: 123n, status: 'DRAFT' }]);

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

  it('getPostById should include status and decode caption from base64', async () => {
    const { service, prisma } = makeService();
    prisma.search.findFirst.mockResolvedValue({
      id: 555n,
      vendorId: 10n,
      caption: 'VGVzdCBjYXB0aW9u',
      deleted: '0',
    });
    prisma.post.findUnique.mockResolvedValue({ status: 'PUBLISHED' });

    const response = await service.getPostById('555', '10');

    expect(response.success).toBe(true);
    expect(response.result).toEqual(
      expect.objectContaining({
        id: '555',
        caption: 'Test caption',
        status: 'PUBLISHED',
      }),
    );
  });
});
