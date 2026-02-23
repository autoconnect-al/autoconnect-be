import { LegacySitemapService } from './legacy-sitemap.service';

describe('LegacySitemapService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses english path mapping for car and motorcycle make/model alternates', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { make: 'BMW', type: 'car' },
          { make: 'Yamaha', type: 'motorcycle' },
        ])
        .mockResolvedValueOnce([
          { make: 'BMW', model: 'X5', type: 'car' },
          { make: 'Yamaha', model: 'MT 07', type: 'motorcycle' },
        ]),
    } as any;

    const service = new LegacySitemapService(prisma);
    const response = await service.getDefaultSitemap();
    const result = (response.result as Array<Record<string, unknown>>) ?? [];

    const carMakeModel = result.find((item) => {
      const en = (item.alternates as any)?.languages?.en as string;
      return typeof en === 'string' && en.includes('/vehicles/cars-for-sale/BMW/X5');
    });
    expect(carMakeModel).toBeDefined();
    expect((carMakeModel?.alternates as any)?.languages?.en).not.toContain(
      '/en/automjete/makina-ne-shitje/',
    );

    const motoMakeModel = result.find((item) => {
      const en = (item.alternates as any)?.languages?.en as string;
      return (
        typeof en === 'string' &&
        en.includes('/vehicles/motorbikes-for-sale/Yamaha/MT%2B07')
      );
    });
    expect(motoMakeModel).toBeDefined();
    expect((motoMakeModel?.alternates as any)?.languages?.en).not.toContain(
      '/en/automjete/motorra-ne-shitje/',
    );
  });

  it('matches default sitemap snapshot for key dynamic route branches', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: '123',
            make: 'Mercedes Benz',
            model: 'C Class',
            accountName: 'dealer1',
            type: 'car',
          },
          {
            id: '456',
            make: 'Yamaha',
            model: 'MT 07',
            accountName: 'dealer2',
            type: 'motorcycle',
          },
        ])
        .mockResolvedValueOnce([
          { make: 'Mercedes Benz', type: 'car' },
          { make: 'Yamaha', type: 'motorcycle' },
        ])
        .mockResolvedValueOnce([
          { make: 'Mercedes Benz', model: 'C Class', type: 'car' },
          { make: 'Yamaha', model: 'MT 07', type: 'motorcycle' },
        ]),
    } as any;

    const service = new LegacySitemapService(prisma);
    const response = await service.getDefaultSitemap();
    const result = (response.result as Array<Record<string, unknown>>) ?? [];
    const keyItems = result
      .filter((item) => {
        const url = String(item.url ?? '');
        return (
          url.includes('/automjete/makine-ne-shitje/') ||
          url.includes('/automjete/motorr-ne-shitje/') ||
          url.includes('/automjete-ne-shitje/dealer1') ||
          url.includes('/automjete-ne-shitje/dealer2')
        );
      })
      .map((item) => ({
        url: item.url,
        lastModified: item.lastModified,
        alternates: (item.alternates as any)?.languages,
      }));

    expect(keyItems).toMatchSnapshot();
  });

  it('matches article sitemap snapshot for autoconnect + rd-construction apps', async () => {
    const prisma = {
      article: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 11n,
              category: 7n,
              data: [
                { language: 'sq-al', title: 'Titulli Shqip' },
                { language: 'en', title: 'English Title' },
              ],
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 22n,
              category: 3n,
              data: [{ language: 'en', title: 'Construction Update' }],
            },
          ]),
      },
    } as any;

    const service = new LegacySitemapService(prisma);

    const autoconnect = await service.getSitemapForApp('autoconnect');
    const rd = await service.getSitemapForApp('rd-construction');

    expect({
      autoconnect: autoconnect.result,
      rdConstruction: rd.result,
    }).toMatchSnapshot();
  });
});
