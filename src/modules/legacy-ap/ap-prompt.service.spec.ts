import { ApPromptService } from './ap-prompt.service';

function createPromptImportJobMock() {
  let job: any = null;
  return {
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (!job) return null;
      return where?.runId === job.runId ? job : null;
    }),
    create: jest.fn().mockImplementation(async ({ data }: any) => {
      job = {
        id: 1n,
        runId: data.runId,
        status: data.status ?? 'RUNNING',
        totalItems: data.totalItems ?? 0,
        checkpointIndex: data.checkpointIndex ?? 0,
        processedItems: data.processedItems ?? 0,
        lastError: data.lastError ?? null,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        dateFinished: data.dateFinished ?? null,
      };
      return job;
    }),
    update: jest.fn().mockImplementation(async ({ data }: any) => {
      if (!job) throw new Error('job not initialized');
      job = {
        ...job,
        ...data,
        dateUpdated: new Date(),
      };
      return job;
    }),
  };
}

describe('ApPromptService.importPromptResults promotion guards', () => {
  it('updates promotion fields from car-details import payload only when provided (including null clear)', async () => {
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
      prompt_import_job: createPromptImportJobMock(),
    } as any;

    const service = new ApPromptService(prisma, {} as any);

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
          renewInterval: null,
          renewedTime: 5,
        },
      ]),
    );

    expect(prisma.post.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.post.update.mock.calls[0][0];
    expect(updateArg.data).toMatchObject({
      live: true,
      revalidate: false,
      renewTo: 1,
      highlightedTo: 2,
      promotionTo: 3,
      mostWantedTo: 4,
      renewInterval: null,
      renewedTime: 5,
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
      prompt_import_job: createPromptImportJobMock(),
    } as any;

    const service = new ApPromptService(prisma, {} as any);

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
    const postUpdateArg = prisma.post.update.mock.calls[0][0];
    expect(postUpdateArg.data).not.toHaveProperty('renewTo');
    expect(postUpdateArg.data).not.toHaveProperty('highlightedTo');
    expect(postUpdateArg.data).not.toHaveProperty('promotionTo');
    expect(postUpdateArg.data).not.toHaveProperty('mostWantedTo');
    expect(postUpdateArg.data).not.toHaveProperty('renewInterval');
    expect(postUpdateArg.data).not.toHaveProperty('renewedTime');
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
      prompt_import_job: createPromptImportJobMock(),
    } as any;

    const service = new ApPromptService(prisma, {} as any);

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
      prompt_import_job: createPromptImportJobMock(),
    } as any;

    const service = new ApPromptService(prisma, {} as any);

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
      prompt_import_job: createPromptImportJobMock(),
    } as any;

    const service = new ApPromptService(prisma, {} as any);

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

  it('saves checkpoint when maxItems budget is reached and resumes by runId', async () => {
    const prisma = {
      post: {
        update: jest.fn().mockResolvedValue({}),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({
            id: 2n,
            post_id: 2n,
            make: 'Audi',
            model: 'A4',
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
      prompt_import_job: createPromptImportJobMock(),
    } as any;
    const service = new ApPromptService(prisma, {} as any);

    const payload = JSON.stringify([
      { id: '1', make: 'BMW', model: 'X5' },
      { id: '2', make: 'Audi', model: 'A4' },
    ]);

    const first = await service.importPromptResults(payload, {
      runId: 'run-1',
      maxItems: 1,
      timeoutMs: 60_000,
    });
    expect(first.success).toBe(true);
    expect(first.message).toContain('Checkpoint saved');
    expect(prisma.car_detail.update).toHaveBeenCalledTimes(1);

    const midStatus = await service.getPromptImportStatus('run-1');
    expect(midStatus.success).toBe(true);
    expect((midStatus.result as any).checkpointIndex).toBe(1);

    const second = await service.importPromptResults(payload, {
      runId: 'run-1',
      maxItems: 10,
      timeoutMs: 60_000,
    });
    expect(second.success).toBe(true);
    expect(second.message).toBe('Updated car detail');
    expect(prisma.car_detail.update).toHaveBeenCalledTimes(2);

    const finalStatus = await service.getPromptImportStatus('run-1');
    expect(finalStatus.success).toBe(true);
    expect((finalStatus.result as any).status).toBe('COMPLETED');
    expect((finalStatus.result as any).checkpointIndex).toBe(2);
  });
});

describe('ApPromptService.generatePrompt variant path', () => {
  it('serializes bigint ids safely when building variant prompt payload', async () => {
    const prisma = {} as any;
    const promptRepository = {
      findVariantProblematicMakes: jest.fn().mockResolvedValue([{ make: 'BMW' }]),
      findMakeModels: jest
        .fn()
        .mockResolvedValue([{ model: 'X5', isVariant: 0 }]),
      findVariantProblemsByMake: jest.fn().mockResolvedValue([
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

    const service = new ApPromptService(prisma, promptRepository);
    const result = await service.generatePrompt(10, 'variant');

    expect(result.size).toBe(1);
    expect(result.prompt).toContain('"id":"123"');
  });
});
