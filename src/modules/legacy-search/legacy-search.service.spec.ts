import { LegacySearchService } from './legacy-search.service';
import { LegacySearchQueryBuilder } from './legacy-search-query-builder';

describe('LegacySearchService', () => {
  it('buildWhere should apply keyword korea clause', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'korea',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '(cleanedCaption LIKE ? OR accountName LIKE ?)',
    );
    expect(built.params).toEqual(
      expect.arrayContaining(['%korea%', '%korea%']),
    );
  });

  it('buildWhere should apply okazion,oferte pricing formula', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'okazion,oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
    expect(built.whereSql).toContain('minPrice > 1');
    expect(built.whereSql).toContain('maxPrice > 1');
  });

  it('buildWhere should apply pricing formula for keyword okazion', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'okazion',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
  });

  it('buildWhere should apply pricing formula for keyword oferte', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      keyword: 'oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain(
      '((price - minPrice) / (maxPrice - price) < 0.25)',
    );
  });

  it('buildWhere should normalize generalSearch tokens', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

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
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      searchTerms: [{ key: 'vendorAccountName', value: 'autokorea.al' }],
    });

    expect(built.whereSql).toContain('accountName = ?');
    expect(built.whereSql).not.toContain('vendorId != 1');
    expect(built.params).toEqual(expect.arrayContaining(['autokorea.al']));
  });

  it('buildWhere should apply customsPaid=true as true-or-null', () => {
    const prisma = { $queryRawUnsafe: jest.fn() } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const built = (service as any).buildWhere({
      type: 'car',
      searchTerms: [{ key: 'customsPaid', value: '1' }],
    });

    expect(built.whereSql).toContain(
      '(customsPaid = 1 OR customsPaid IS NULL)',
    );
  });

  it('relatedById should select sidecarMedias for related cards', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([]),
    } as any;

    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());
    await service.relatedById('1', 'car');

    const secondQuery = prisma.$queryRawUnsafe.mock.calls[1][0] as string;
    expect(secondQuery).toContain('sidecarMedias');
    expect(secondQuery).toContain('profilePicture');
    expect(secondQuery).toContain('promotionTo');
    expect(secondQuery).toContain('renewInterval');
  });

  it('relatedById should include car_detail object in response rows', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([
          {
            id: 2,
            make: 'BMW',
            model: 'X5',
            price: 12000,
            customsPaid: 1,
          },
        ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.relatedById('1', 'car');
    const first = (response.result as Array<Record<string, unknown>>)[0];
    expect(first.car_detail).toMatchObject({
      make: 'BMW',
      model: 'X5',
      price: 12000,
      customsPaid: 1,
    });
  });

  it('mostWanted should include car_detail object in response rows', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 2,
          make: 'Audi',
          model: 'A6',
          price: 20000,
          customsPaid: 0,
        },
      ]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    const response = await service.mostWanted();
    const first = (response.result as Array<Record<string, unknown>>)[0];
    expect(first.car_detail).toMatchObject({
      make: 'Audi',
      model: 'A6',
      price: 20000,
      customsPaid: 0,
    });
  });

  it('mostWanted should select promotion fields from search', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.mostWanted();

    const query = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(query).toContain('promotionTo');
    expect(query).toContain('highlightedTo');
    expect(query).toContain('renewTo');
    expect(query).toContain('renewInterval');
    expect(query).toContain('renewedTime');
    expect(query).toContain('mostWantedTo');
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

    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());
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

  it('mostWanted should bind excluded ids/accounts as params, not SQL string concat', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.mostWanted("1,2,'3", "foo,bar' OR 1=1 --");

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    const query = call[0] as string;
    expect(query).toContain('id NOT IN (?,?,?)');
    expect(query).toContain('accountName NOT IN (?,?)');
    expect(query).not.toContain("bar' OR 1=1 --");
    expect(call.slice(2)).toEqual(
      expect.arrayContaining(['1', '2', "'3", 'foo', "bar' OR 1=1 --"]),
    );
  });

  it('relatedById should use parameterized excluded ids list', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW', model: 'X5' }])
        .mockResolvedValueOnce([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.relatedById('1', 'car', "2,3,'4");

    const call = prisma.$queryRawUnsafe.mock.calls[1];
    const query = call[0] as string;
    expect(query).toContain('id NOT IN (?,?,?)');
    expect(call.slice(1)).toEqual(
      expect.arrayContaining(['BMW', 'X5', '1', 'car', '2', '3', "'4"]),
    );
  });

  it('relatedByFilter should use parameterized excluded ids list', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacySearchService(prisma, new LegacySearchQueryBuilder());

    await service.relatedByFilter(
      JSON.stringify({ searchTerms: [{ key: 'make1', value: 'BMW' }] }),
      'car',
      "10,11,'12",
    );

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    const query = call[0] as string;
    expect(query).toContain('id NOT IN (?,?,?)');
    expect(call.slice(1)).toEqual(
      expect.arrayContaining(['car', '10', '11', "'12", 'BMW']),
    );
  });
});
