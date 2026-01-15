import { Test, TestingModule } from '@nestjs/testing';
import { SearchPostService } from './search-post.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('SearchPostService', () => {
  let service: SearchPostService;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  const samplePost = {
    id: BigInt(123),
    dateCreated: new Date('2026-01-15T00:00:00Z'),
    deleted: '0',
    caption: Buffer.from('This is a test caption').toString('base64'),
    cleanedCaption: 'this is a test caption',
    createdTime: 1670000000,
    vendorId: BigInt(42),
    make: 'BMW',
    model: 'X5',
    variant: 'M',
    registration: 2022,
    mileage: 15000,
    price: 50000,
    transmission: 'Automatic',
    fuelType: 'Petrol',
    bodyType: 'SUV',
    type: 'car',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchPostService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SearchPostService>(SearchPostService);
  });

  it('should return post with id as string and caption decoded', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([samplePost]);

    const result = await service.getPostById('123');

    expect(result.id).toBe('123');
    expect(result.vendorId).toBe('42');
    expect(result.caption).toBe('This is a test caption');
    expect(result.make).toBe('BMW');
    expect(result.model).toBe('X5');
    expect(result.type).toBe('car');
  });

  it('should throw NotFoundException if post does not exist', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

    await expect(service.getPostById('999')).rejects.toThrow(NotFoundException);
  });

  it('should handle optional fields correctly', async () => {
    const postWithOptional = {
      ...samplePost,
      variant: null,
      registration: null,
    };
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([postWithOptional]);

    const result = await service.getPostById('123');

    expect(result.variant).toBeNull();
    expect(result.registration).toBeNull();
  });
});
