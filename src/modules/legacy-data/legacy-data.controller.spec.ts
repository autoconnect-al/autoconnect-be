import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { LegacyDataController } from './legacy-data.controller';
import { LegacyDataService } from './legacy-data.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalMediaService } from './local-media.service';
import {
  extractLegacyBearerToken,
  verifyAndDecodeLegacyJwtPayload,
} from '../../common/legacy-auth.util';

jest.mock('../../common/legacy-auth.util', () => ({
  extractLegacyBearerToken: jest.fn(),
  verifyAndDecodeLegacyJwtPayload: jest.fn(),
}));

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
    (extractLegacyBearerToken as jest.Mock).mockReturnValue('token');
    (verifyAndDecodeLegacyJwtPayload as jest.Mock).mockReturnValue({
      email: 'user@example.com',
    });
    const body = { post: { caption: 'x' } };

    await controller.createPost(body, {
      authorization: 'Bearer token',
    } as Record<string, unknown>);

    expect(localPostOrderService.createPost).toHaveBeenCalledWith(
      body,
      'user@example.com',
    );
  });

  it('passes jwt email to updatePost when token is valid', async () => {
    (extractLegacyBearerToken as jest.Mock).mockReturnValue('token');
    (verifyAndDecodeLegacyJwtPayload as jest.Mock).mockReturnValue({
      email: 'editor@example.com',
    });
    const body = { post: { id: '123' } };

    await controller.updatePost(body, {
      authorization: 'Bearer token',
    } as Record<string, unknown>);

    expect(localPostOrderService.updatePost).toHaveBeenCalledWith(
      body,
      'editor@example.com',
    );
  });

  it('throws 401 for invalid jwt payload on createPost', async () => {
    (extractLegacyBearerToken as jest.Mock).mockReturnValue('token');
    (verifyAndDecodeLegacyJwtPayload as jest.Mock).mockReturnValue(null);

    await expect(
      controller.createPost(
        { post: {} },
        { authorization: 'Bearer token' } as Record<string, unknown>,
      ),
    ).rejects.toMatchObject<HttpException>({
      response: {
        success: false,
        message: 'JWT token is not valid.',
        statusCode: '401',
      },
      status: 401,
    });
  });
});
