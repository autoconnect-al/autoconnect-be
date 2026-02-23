import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { LegacyDataController } from './legacy-data.controller';
import { LegacyDataService } from './legacy-data.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalMediaService } from './local-media.service';
describe('LegacyDataController jwt email handling', () => {
  let controller: LegacyDataController;
  let localPostOrderService: {
    createPost: jest.Mock;
    updatePost: jest.Mock;
  };

  beforeEach(async () => {
    localPostOrderService = {
      createPost: jest.fn().mockResolvedValue({ success: true }),
      updatePost: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegacyDataController],
      providers: [
        {
          provide: LegacyDataService,
          useValue: {},
        },
        {
          provide: LocalPostOrderService,
          useValue: localPostOrderService,
        },
        {
          provide: LocalMediaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<LegacyDataController>(LegacyDataController);
    jest.clearAllMocks();
  });

  it('passes jwt email to createPost when token is valid', async () => {
    const body = { post: { caption: 'x' } };

    await controller.createPost(body, 'user@example.com');

    expect(localPostOrderService.createPost).toHaveBeenCalledWith(
      body,
      'user@example.com',
    );
  });

  it('passes jwt email to updatePost when token is valid', async () => {
    const body = { post: { id: '123' } };

    await controller.updatePost(body, 'editor@example.com');

    expect(localPostOrderService.updatePost).toHaveBeenCalledWith(
      body,
      'editor@example.com',
    );
  });

  it('throws 500 when createPost service fails', async () => {
    localPostOrderService.createPost.mockResolvedValueOnce({ success: false });

    await expect(
      controller.createPost({ post: {} }, undefined),
    ).rejects.toMatchObject<HttpException>({
      response: {
        success: false,
        message: 'ERROR: Something went wrong',
        statusCode: '500',
      },
      status: 500,
    });
  });
});
