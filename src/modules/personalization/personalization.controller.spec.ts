import { BadRequestException } from '@nestjs/common';
import { PersonalizationController } from './personalization.controller';

describe('PersonalizationController', () => {
  it('throws for invalid visitor id', async () => {
    const controller = new PersonalizationController({
      resetVisitorProfile: jest.fn().mockResolvedValue(false),
    } as any);

    await expect(controller.reset(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns success envelope for valid reset', async () => {
    const controller = new PersonalizationController({
      resetVisitorProfile: jest.fn().mockResolvedValue(true),
    } as any);

    await expect(controller.reset('visitor-123')).resolves.toEqual({
      success: true,
      statusCode: '200',
      message: 'Personalization profile reset',
      result: 'OK',
    });
  });
});
