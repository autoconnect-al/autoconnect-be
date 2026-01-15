import { Test, TestingModule } from '@nestjs/testing';
import { RelatedPostsService } from './related-posts.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('RelatedPostsService', () => {
  let service: RelatedPostsService;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  const samplePost = {
    id: BigInt(100),
    make: 'BMW',
    model: 'X5',
    type: 'car',
    deleted: '0',
    cleanedCaption: 'bmw x5',
    sidecarMedias: JSON.stringify([{ imageThumbnailUrl: 'url1' }]),
  };

  const relatedPost = {
    id: BigInt(101),
    make: 'BMW',
    model: 'X5',
    type: 'car',
    deleted: '0',
    cleanedCaption: 'bmw x5 related',
    sidecarMedias: JSON.stringify([{ imageThumbnailUrl: 'url2' }]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatedPostsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RelatedPostsService>(RelatedPostsService);
  });

  it('throws NotFoundException if post not found', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
    await expect(service.getRelatedByPostId('999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('fetches related posts by post ID', async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([samplePost]) // fetch reference post
      .mockResolvedValueOnce([relatedPost]); // fetch related

    const result = await service.getRelatedByPostId('100');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(relatedPost.id);
  });

  it('fetches related posts by filter', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([relatedPost]);
    const result = await service.getRelatedByFilter({
      make1: 'BMW',
      model1: 'X5',
    });
    expect(result[0].make).toBe('BMW');
    expect(result[0].model).toBe('X5');
  });

  it('returns cleaned caption and media URL', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([samplePost]);
    const result = await service.getPostCaption('100');
    expect(result.cleanedCaption).toBe('bmw x5');
    expect(result.mediaUrl).toBe('url1');
  });
});
