import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../database/prisma.service';
import { normalizeGeneralSearch } from '../../common/search/search-normalizer';

describe('SearchService', () => {
  let service: SearchService;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns paginated results', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: 1 }]) // items
      .mockResolvedValueOnce([{ total: 1 }]); // count

    const result = await service.search({ page: 1, limit: 10 });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.items.length).toBe(1);
    expect(result.total).toBe(1);
  });

  it('uses FULLTEXT search when generalSearch is provided', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await service.search({ generalSearch: 'bmw x5' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const call = prismaMock.$queryRawUnsafe.mock.calls[0][0];
    expect(call).toContain('MATCH(cleanedCaption)');
  });

  it('applies sorting correctly', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await service.search({ sortBy: 'price', sortOrder: 'asc' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const call = prismaMock.$queryRawUnsafe.mock.calls[0][0];
    expect(call).toContain('ORDER BY price asc');
  });

  it('normalizes bmw 5 series', () => {
    expect(normalizeGeneralSearch('bmw 5 series')).toEqual(['5-series']);
  });

  it('does not affect non-bmw series', () => {
    expect(normalizeGeneralSearch('ford series 3')).not.toContain('3-series');
  });
});
