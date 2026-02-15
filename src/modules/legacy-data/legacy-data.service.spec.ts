import { LegacyDataService } from './legacy-data.service';

describe('LegacyDataService', () => {
  it('article should query raw id and appName', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacyDataService(prisma);

    await service.article('en', '1', 'autoconnect');

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('id = ?');
    expect(call[1]).toBe('1');
    expect(call[2]).toBe('autoconnect');
  });

  it('articles should use raw category and legacy pagination size 9', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacyDataService(prisma);

    await service.articles('en', 'cars', 2, 'autoconnect');

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('category = ?');
    expect(call[0]).toContain('LIMIT 9 OFFSET ?');
    expect(call[1]).toBe('cars');
    expect(call[2]).toBe('autoconnect');
    expect(call[3]).toBe(18);
  });

  it('articlesTotal should divide by 9 pages', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ total: 18 }]),
    } as any;
    const service = new LegacyDataService(prisma);

    const response = await service.articlesTotal('en', 'cars', 'autoconnect');

    expect(response.result).toBe(2);
  });

  it('vendor should enforce deleted/initialised/accountExists constraints', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
    const service = new LegacyDataService(prisma);

    await service.vendor('autokorea-al');

    const call = prisma.$queryRawUnsafe.mock.calls[0];
    expect(call[0]).toContain('deleted = 0');
    expect(call[0]).toContain('initialised = 1');
    expect(call[0]).toContain('accountExists = 1');
    expect(call[1]).toBe('autokorea.al');
  });

  it('vendorBiography should normalize punctuation', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          biography: 'Hello , world ! Nice - text : test',
          profilePicture: 'pic.jpg',
        },
      ]),
    } as any;
    const service = new LegacyDataService(prisma);

    const response = await service.vendorBiography('autokorea.al');

    expect(response.result).toEqual({
      biography: 'Hello, world! Nice-text:test',
      profilePicture: 'pic.jpg',
    });
  });
});
