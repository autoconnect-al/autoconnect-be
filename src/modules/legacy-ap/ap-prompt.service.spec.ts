import { ApPromptService } from './ap-prompt.service';

describe('ApPromptService.importPromptResults promotion guards', () => {
  it('does not update promotion fields from car-details import payload', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          post_id: 1n,
          make: 'BMW',
          model: 'X5',
          variant: null,
          registration: null,
          mileage: null,
          transmission: null,
          fuelType: null,
          engineSize: null,
          drivetrain: null,
          seats: null,
          numberOfDoors: null,
          bodyType: null,
          price: null,
          sold: false,
          customsPaid: false,
          priceVerified: false,
          mileageVerified: false,
          fuelVerified: false,
          contact: null,
          type: 'car',
        }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new ApPromptService(prisma);

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          caption: 'Makina ne shitje pa reference dogane',
          make: 'BMW',
          model: 'X5',
          registration: 2015,
          priceVerified: true,
          mileageVerified: true,
          fuelVerified: true,
          engineSize: 3,
          renewTo: 1,
          highlightedTo: 2,
          promotionTo: 3,
          mostWantedTo: 4,
        },
      ]),
    );

    expect(prisma.post.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.post.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('renewTo');
    expect(updateArg.data).not.toHaveProperty('highlightedTo');
    expect(updateArg.data).not.toHaveProperty('promotionTo');
    expect(updateArg.data).not.toHaveProperty('mostWantedTo');
    expect(updateArg.data).toMatchObject({
      live: true,
      revalidate: false,
    });

    expect(prisma.car_detail.update).toHaveBeenCalledTimes(1);
    const carDetailUpdateArg = prisma.car_detail.update.mock.calls[0][0];
    expect(carDetailUpdateArg.data).toMatchObject({
      registration: '2015',
      engineSize: '3',
      customsPaid: null,
      priceVerified: true,
      mileageVerified: true,
      fuelVerified: true,
    });
    expect(prisma.car_detail.findUnique).not.toHaveBeenCalled();
  });

  it('updates car detail when row is linked by post_id and id differs', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({
          id: 999n,
          post_id: 1n,
          make: 'BMW',
          model: 'X5',
          variant: 'old',
          registration: '2012',
          mileage: null,
          transmission: null,
          fuelType: null,
          engineSize: null,
          drivetrain: null,
          seats: null,
          numberOfDoors: null,
          bodyType: null,
          price: null,
          sold: false,
          customsPaid: false,
          priceVerified: false,
          mileageVerified: false,
          fuelVerified: false,
          contact: null,
          type: 'car',
        }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new ApPromptService(prisma);

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          make: 'BMW',
          model: 'X5',
          variant: 'new-variant',
        },
      ]),
    );

    expect(prisma.car_detail.findFirst).toHaveBeenCalledWith({
      where: {
        post_id: 1n,
      },
      orderBy: [{ dateUpdated: 'desc' }, { id: 'desc' }],
    });
    expect(prisma.car_detail.findUnique).not.toHaveBeenCalled();
    expect(prisma.car_detail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 999n },
        data: expect.objectContaining({
          variant: 'new-variant',
        }),
      }),
    );
  });

  it('falls back to id lookup when no post_id-linked row exists', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          post_id: null,
          make: 'BMW',
          model: 'X5',
          variant: 'old',
          registration: null,
          mileage: null,
          transmission: null,
          fuelType: null,
          engineSize: null,
          drivetrain: null,
          seats: null,
          numberOfDoors: null,
          bodyType: null,
          price: null,
          sold: false,
          customsPaid: false,
          priceVerified: false,
          mileageVerified: false,
          fuelVerified: false,
          contact: null,
          type: 'car',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new ApPromptService(prisma);

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          make: 'BMW',
          model: 'X5',
          variant: 'new-variant',
        },
      ]),
    );

    expect(prisma.car_detail.findFirst).toHaveBeenCalled();
    expect(prisma.car_detail.findUnique).toHaveBeenCalledWith({
      where: { id: 1n },
    });
    expect(prisma.car_detail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({
          variant: 'new-variant',
        }),
      }),
    );
  });

  it('treats explicit customsPaid=false as unknown when caption has no customs signal', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          post_id: 1n,
          make: 'BMW',
          model: 'X5',
          variant: null,
          registration: null,
          mileage: null,
          transmission: null,
          fuelType: null,
          engineSize: null,
          drivetrain: null,
          seats: null,
          numberOfDoors: null,
          bodyType: null,
          price: null,
          sold: false,
          customsPaid: true,
          priceVerified: false,
          mileageVerified: false,
          fuelVerified: false,
          contact: null,
          type: 'car',
        }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new ApPromptService(prisma);

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          make: 'BMW',
          model: 'X5',
          customsPaid: false,
          caption: 'Makina ne gjendje shume te mire',
        },
      ]),
    );

    const carDetailUpdateArg = prisma.car_detail.update.mock.calls[0][0];
    expect(carDetailUpdateArg.data).toMatchObject({
      customsPaid: null,
    });
  });

  it('keeps explicit customsPaid=false when caption signals unpaid customs', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          post_id: 1n,
          make: 'BMW',
          model: 'X5',
          variant: null,
          registration: null,
          mileage: null,
          transmission: null,
          fuelType: null,
          engineSize: null,
          drivetrain: null,
          seats: null,
          numberOfDoors: null,
          bodyType: null,
          price: null,
          sold: false,
          customsPaid: true,
          priceVerified: false,
          mileageVerified: false,
          fuelVerified: false,
          contact: null,
          type: 'car',
        }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = new ApPromptService(prisma);

    await service.importPromptResults(
      JSON.stringify([
        {
          id: '1',
          make: 'BMW',
          model: 'X5',
          customsPaid: false,
          caption: 'Sapo ardhur, deri ne durres',
        },
      ]),
    );

    const carDetailUpdateArg = prisma.car_detail.update.mock.calls[0][0];
    expect(carDetailUpdateArg.data).toMatchObject({
      customsPaid: false,
    });
  });
});

describe('ApPromptService.generatePrompt variant path', () => {
  it('serializes bigint ids safely when building variant prompt payload', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ make: 'BMW' }])
        .mockResolvedValueOnce([{ model: 'X5', isVariant: 0 }])
        .mockResolvedValueOnce([
          {
            id: 123n,
            make: 'BMW',
            model: 'X5',
            variant: 'xDrive',
            bodyType: 'SUV',
            fuelType: 'diesel',
            engineSize: '2.0',
          },
        ]),
    } as any;

    const service = new ApPromptService(prisma);
    const result = await service.generatePrompt(10, 'variant');

    expect(result.size).toBe(1);
    expect(result.prompt).toContain('"id":"123"');
  });
});
