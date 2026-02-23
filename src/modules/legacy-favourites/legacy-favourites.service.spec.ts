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
});
