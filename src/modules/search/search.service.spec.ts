import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../database/prisma.service';
import { normalizeGeneralSearch } from '../../common/search/search-normalizer';
import { SearchHelper } from './common/search-helper';
import { SearchDto } from './dto/search.dto';

describe('SearchService', () => {
  let service: SearchService;
  let searchHelper: SearchHelper;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  const promotedPost = {
    id: BigInt(100),
    make: 'BMW',
    model: 'X5',
    promotionTo: Math.floor(Date.now() / 1000) + 10000,
    cleanedCaption: 'bmw x5',
    deleted: '0',
  };

  const normalPost = {
    id: BigInt(101),
    make: 'Audi',
    model: 'A4',
    promotionTo: null,
    cleanedCaption: 'audi a4',
    deleted: '0',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: SearchHelper,
          useValue: {
            getCorrectMake: jest.fn(),
            prepareMakeModel: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    searchHelper = module.get<SearchHelper>(SearchHelper);
  });

  it('should normalize make and model correctly', async () => {
    // Arrange
    const dto: SearchDto = {
      make1: 'BMW',
      model1: 'X5 (all)',
    };

    // Mock normalized return values
    (searchHelper.getCorrectMake as jest.Mock).mockResolvedValue('BMW');
    (searchHelper.prepareMakeModel as jest.Mock).mockResolvedValue({
      model: 'X5',
      isVariant: false,
    });

    // Mock Prisma to return empty results
    (service['prisma'].$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

    // Act
    await service.search(dto);

    // Assert
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(searchHelper.getCorrectMake).toHaveBeenCalledWith('BMW');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(searchHelper.prepareMakeModel).toHaveBeenCalledWith(
      'BMW',
      'X5 (all)',
    );

    expect(dto.make1).toBe('BMW');

    expect(dto.model1).toBe('X5');
  });

  it('returns paginated results', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([promotedPost])
      .mockResolvedValueOnce([{ id: 1 }]) // items
      .mockResolvedValueOnce([{ total: 1 }]); // count

    const result = await service.search({ page: 1, limit: 10 });

    expect(result.items.length).toBe(2);
    expect(result.total).toBe(1);
  });

  it('uses FULLTEXT search when generalSearch is provided', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([promotedPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await service.search({ generalSearch: 'bmw x5' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const call = prismaMock.$queryRawUnsafe.mock.calls[0][0];
    expect(call).toContain('MATCH(cleanedCaption)');
  });

  it('normalizes bmw 5 series', () => {
    expect(normalizeGeneralSearch('bmw 5 series')).toEqual(['5-series']);
  });

  it('does not affect non-bmw series', () => {
    expect(normalizeGeneralSearch('ford series 3')).not.toContain('3-series');
  });

  it('includes promoted post on top and excludes it from main results', async () => {
    prismaMock.$queryRawUnsafe
      // fetchPromotedPost
      .mockResolvedValueOnce([promotedPost])
      // main search
      .mockResolvedValueOnce([normalPost])
      // count query
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await service.search({ page: 1, limit: 10 }, 'user1');

    expect(result.items[0].id).toBe(promotedPost.id.toString());
    expect(result.items[1].id).toBe(normalPost.id.toString());
  });

  it('rotates promoted post after 2 actions', async () => {
    const promoted1 = { ...promotedPost, id: BigInt(200) };
    const promoted2 = { ...promotedPost, id: BigInt(201) };

    // 1st search
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([promoted1]) // promoted
      .mockResolvedValueOnce([normalPost]) // main search
      .mockResolvedValueOnce([{ total: 1 }]);

    let result = await service.search({ page: 1, limit: 10 }, 'user2');
    expect(result.items[0].id).toBe('200');

    // 2nd search (rotate)
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([promoted2]) // new promoted
      .mockResolvedValueOnce([normalPost]) // main search
      .mockResolvedValueOnce([{ total: 1 }]);

    result = await service.search({ page: 1, limit: 10 }, 'user2');
    expect(result.items[0].id).toBe('201');
  });

  it('anonymous user gets a promoted post randomly', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([promotedPost]) // promoted
      .mockResolvedValueOnce([normalPost]) // main search
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await service.search({ page: 1, limit: 10 });
    expect(result.items[0].id).toBe(promotedPost.id.toString());
  });

  it('main search returns only normal posts if no promoted', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([]) // no promoted
      .mockResolvedValueOnce([normalPost]) // main search
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await service.search({ page: 1, limit: 10 }, 'user3');

    expect(result.items[0].id).toBe(normalPost.id.toString());
    expect(result.items.length).toBe(1);
  });

  it('applies sorting correctly', async () => {
    // Force no promoted post
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([]) // promoted post: empty
      .mockResolvedValueOnce([]) // main search
      .mockResolvedValueOnce([{ total: 0 }]); // count query

    await service.search(
      { sortBy: 'price', sortOrder: 'asc' },
      'user-sorting-test',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const call = prismaMock.$queryRawUnsafe.mock.calls[1][0]; // main search is 2nd call now
    expect(call).toContain('ORDER BY price asc');
  });
});
