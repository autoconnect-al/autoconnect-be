import { LegacySearchService } from './legacy-search.service';

describe('LegacySearchService', () => {
  it('buildWhere should apply keyword korea clause', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma);

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'korea',
      searchTerms: [],
    });

    expect(built.whereSql).toContain('(cleanedCaption LIKE ? OR accountName LIKE ?)');
    expect(built.params).toEqual(expect.arrayContaining(['%korea%', '%korea%']));
  });

  it('buildWhere should apply okazion,oferte pricing formula', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma);

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'okazion,oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain('((price - minPrice) / (maxPrice - price) < 0.25)');
    expect(built.whereSql).toContain('minPrice > 1');
    expect(built.whereSql).toContain('maxPrice > 1');
  });

  it('buildWhere should normalize generalSearch tokens', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma);

    const built = (service as any).buildWhere({
      type: 'car',
      generalSearch: 'Benc Seria 5',
      searchTerms: [],
    });

    expect(built.params).toEqual(expect.arrayContaining(['%benz%']));
    expect(built.whereSql).toContain('cleanedCaption LIKE ?');
  });

  it('buildWhere should support vendorAccountName active listing filter', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma);

    const built = (service as any).buildWhere({
      type: 'car',
      searchTerms: [{ key: 'vendorAccountName', value: 'autokorea.al' }],
    });

    expect(built.whereSql).toContain('accountName = ?');
    expect(built.whereSql).not.toContain('vendorId != 1');
    expect(built.params).toEqual(expect.arrayContaining(['autokorea.al']));
  });

  it('relatedById should select sidecarMedias for related cards', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([]),
    } as any;

    const service = new LegacySearchService(prisma);
    await service.relatedById('1', 'car');

    const secondQuery = prisma.$queryRawUnsafe.mock.calls[1][0] as string;
    expect(secondQuery).toContain('sidecarMedias');
    expect(secondQuery).toContain('profilePicture');
  });

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
