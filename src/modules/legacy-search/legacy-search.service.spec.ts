import { LegacySearchService } from './legacy-search.service';

describe('LegacySearchService', () => {
  it('getCarDetails should decode base64 caption to text', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 42n,
          caption: 'SGVsbG8gZnJvbSBzZWFyY2g=',
          deleted: '0',
        },
      ]),
    } as any;

    const service = new LegacySearchService(prisma);
    const response = await service.getCarDetails('42');

    expect(response.success).toBe(true);
    expect(Array.isArray(response.result)).toBe(true);
    expect(response.result[0]).toEqual(
      expect.objectContaining({
        id: '42',
        caption: 'Hello from search',
      }),
    );
  });
});
