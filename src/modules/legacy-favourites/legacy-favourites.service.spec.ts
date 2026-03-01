import { LegacyFavouritesService } from './legacy-favourites.service';

describe('LegacyFavouritesService', () => {
  it('returns 400 when favourites list exceeds max ids', async () => {
    const prisma = {
      search: {
        findMany: jest.fn(),
      },
    } as any;
    const service = new LegacyFavouritesService(prisma);
    const tooMany = Array.from({ length: 201 }, (_, i) => String(i + 1)).join(
      ',',
    );

    const response = await service.checkFavourites(tooMany);

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe('400');
    expect(prisma.search.findMany).not.toHaveBeenCalled();
  });

  it('returns matched ids for valid bounded list', async () => {
    const prisma = {
      search: {
        findMany: jest.fn().mockResolvedValue([{ id: 1n }, { id: 3n }]),
      },
    } as any;
    const service = new LegacyFavouritesService(prisma);

    const response = await service.checkFavourites('1,2,3');

    expect(response.success).toBe(true);
    expect(response.result).toEqual(['1', '3']);
    expect(prisma.search.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [1n, 2n, 3n] },
        }),
      }),
    );
  });

  it('caches repeated check lookups by normalized id list', async () => {
    const prisma = {
      search: {
        findMany: jest.fn().mockResolvedValue([{ id: 10n }, { id: 20n }]),
      },
    } as any;
    const service = new LegacyFavouritesService(prisma);

    const first = await service.checkFavourites('20,10');
    const second = await service.checkFavourites('10,20,20');

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.result).toEqual(['10', '20']);
    expect(prisma.search.findMany).toHaveBeenCalledTimes(1);
  });

  it('getFavourites should return rows enriched with post stats and no postOpen', async () => {
    const prisma = {
      search: {
        findMany: jest.fn().mockResolvedValue([
          { id: 101n, deleted: '0', sold: false },
        ]),
      },
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101n,
            impressions: 11,
            reach: 9,
            clicks: 4,
            contact: 3,
            contactCall: 2,
            contactWhatsapp: 1,
            contactEmail: 0,
            contactInstagram: 0,
          },
        ]),
      },
    } as any;
    const service = new LegacyFavouritesService(prisma);

    const response = await service.getFavourites('101');

    expect(response.success).toBe(true);
    expect(response.result).toEqual([
      expect.objectContaining({
        id: '101',
        impressions: 11,
        reach: 9,
        clicks: 4,
        contactCount: 3,
        contactCall: 2,
        contactWhatsapp: 1,
        contactEmail: 0,
        contactInstagram: 0,
      }),
    ]);
    expect(response.result[0]).not.toHaveProperty('postOpen');
  });

  it('getFavourites should keep cached search rows but refresh stats per request', async () => {
    const prisma = {
      search: {
        findMany: jest.fn().mockResolvedValue([
          { id: 201n, deleted: '0', sold: false },
        ]),
      },
      post: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 201n,
              impressions: 1,
              reach: 1,
              clicks: 1,
              contact: 1,
              contactCall: 0,
              contactWhatsapp: 0,
              contactEmail: 0,
              contactInstagram: 0,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 201n,
              impressions: 9,
              reach: 8,
              clicks: 7,
              contact: 6,
              contactCall: 5,
              contactWhatsapp: 4,
              contactEmail: 3,
              contactInstagram: 2,
            },
          ]),
      },
    } as any;
    const service = new LegacyFavouritesService(prisma);

    const first = await service.getFavourites('201');
    const second = await service.getFavourites('201');

    expect(first.result[0]).toEqual(
      expect.objectContaining({
        impressions: 1,
        clicks: 1,
        contactCount: 1,
      }),
    );
    expect(second.result[0]).toEqual(
      expect.objectContaining({
        impressions: 9,
        clicks: 7,
        contactCount: 6,
      }),
    );
    expect(prisma.search.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.findMany).toHaveBeenCalledTimes(2);
  });
});
