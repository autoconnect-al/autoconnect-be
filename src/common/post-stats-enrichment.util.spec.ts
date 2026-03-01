import { enrichRowsWithPostStats } from './post-stats-enrichment.util';

describe('enrichRowsWithPostStats', () => {
  it('adds stats projection by post id and maps post.contact to contactCount', async () => {
    const prisma = {
      post: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            impressions: 50,
            reach: 42,
            clicks: 15,
            contact: 9,
            contactCall: 4,
            contactWhatsapp: 3,
            contactEmail: 1,
            contactInstagram: 1,
          },
        ]),
      },
    } as any;

    const rows = [
      { id: '1', make: 'BMW' },
      { id: '2', make: 'Audi' },
    ];

    const enriched = (await enrichRowsWithPostStats(prisma, rows)) as Array<
      Record<string, unknown>
    >;

    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1n, 2n] } },
      select: {
        id: true,
        impressions: true,
        reach: true,
        clicks: true,
        contactCall: true,
        contactWhatsapp: true,
        contactEmail: true,
        contactInstagram: true,
        contact: true,
      },
    });

    expect(enriched[0]).toEqual(
      expect.objectContaining({
        id: '1',
        impressions: 50,
        reach: 42,
        clicks: 15,
        contactCount: 9,
        contactCall: 4,
        contactWhatsapp: 3,
        contactEmail: 1,
        contactInstagram: 1,
      }),
    );
    expect(enriched[1]).toEqual(
      expect.objectContaining({
        id: '2',
        impressions: 0,
        reach: 0,
        clicks: 0,
        contactCount: 0,
        contactCall: 0,
        contactWhatsapp: 0,
        contactEmail: 0,
        contactInstagram: 0,
      }),
    );
  });

  it('falls back to zero stats when post repository is unavailable', async () => {
    const rows = [{ id: '10', model: 'X5' }];
    const enriched = (await enrichRowsWithPostStats(
      { post: undefined } as any,
      rows,
    )) as Array<Record<string, unknown>>;

    expect(enriched[0]).toEqual(
      expect.objectContaining({
        id: '10',
        impressions: 0,
        reach: 0,
        clicks: 0,
        contactCount: 0,
        contactCall: 0,
        contactWhatsapp: 0,
        contactEmail: 0,
        contactInstagram: 0,
      }),
    );
  });
});
