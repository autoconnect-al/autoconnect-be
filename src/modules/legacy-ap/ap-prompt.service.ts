import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { decodeCaption, isCustomsPaid } from '../imports/utils/caption-processor';
import { sanitizePostUpdateDataForSource } from '../../common/promotion-field-guard.util';
import { ApPromptRepository } from './ap-prompt.repository';

interface PromptImportOptions {
  runId?: string;
  timeoutMs?: number;
  maxItems?: number;
}

const DEFAULT_PROMPT_IMPORT_TIMEOUT_MS = 20_000;
const DEFAULT_PROMPT_IMPORT_MAX_ITEMS = 250;

@Injectable()
export class ApPromptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptRepository: ApPromptRepository,
  ) {}

  async generatePrompt(length: number, mode: string) {
    const safeLength =
      Number.isFinite(length) && length > 0 ? Math.trunc(length) : 3700;
    const modeNormalized = mode.toLowerCase();

    if (modeNormalized === 'variant') {
      const prompt = await this.generateVariantPrompt(safeLength);
      return prompt;
    }

    if (modeNormalized === 'registration') {
      return this.generateRegistrationPrompt(safeLength);
    }
    if (modeNormalized === 'mileage') {
      return this.generateMileagePrompt(safeLength);
    }
    if (modeNormalized === 'price') {
      return this.generatePricePrompt(safeLength);
    }
    if (modeNormalized === 'motorcycle') {
      return this.generateMotorcyclePrompt(safeLength);
    }
    return this.generateGeneralPrompt(safeLength);
  }

  async getManualDraftPosts() {
    const rows = await this.prisma.post.findMany({
      where: {
        deleted: false,
        origin: 'MANUAL',
        status: 'DRAFT',
      },
      include: {
        car_detail_car_detail_post_idTopost: true,
      },
      orderBy: { dateUpdated: 'desc' },
      take: 200,
    });

    const mapped = rows.map((row) => {
      const details = row.car_detail_car_detail_post_idTopost?.[0] ?? null;
      return this.normalizeBigInts({
        ...row,
        caption: row.caption
          ? Buffer.from(row.caption, 'base64').toString('utf8')
          : row.caption,
        details,
      });
    });

    return legacySuccess(
      mapped,
      mapped.length
        ? 'Found manual draft posts'
        : 'No manual draft posts found',
    );
  }

  async importPromptResults(
    resultJson: string,
    options?: PromptImportOptions,
  ) {
    let parsed: Array<Record<string, unknown>> = [];
    try {
      const value = JSON.parse(resultJson);
      if (Array.isArray(value)) {
        parsed = value as Array<Record<string, unknown>>;
      }
    } catch {
      return legacyError('Exception occurred while importing result');
    }

    const normalized = this.normalizePromptImportOptions(options);
    const runId = normalized.runId || this.generatePromptImportRunId();
    const totalItems = parsed.length;

    let job = await this.prisma.prompt_import_job.findUnique({
      where: { runId },
    });
    if (!job) {
      job = await this.prisma.prompt_import_job.create({
        data: {
          runId,
          status: 'RUNNING',
          totalItems,
          checkpointIndex: 0,
          processedItems: 0,
          dateFinished: null,
          lastError: null,
        },
      });
    } else if (job.totalItems !== totalItems) {
      return legacyError('Payload size does not match existing run checkpoint', 409);
    } else {
      await this.prisma.prompt_import_job.update({
        where: { runId },
        data: {
          status: 'RUNNING',
          dateFinished: null,
          lastError: null,
        },
      });
    }

    if (job.checkpointIndex >= totalItems) {
      const status = await this.getPromptImportStatus(runId);
      return legacySuccess(status.result, 'Prompt import already completed');
    }

    const startedAt = Date.now();
    let checkpointIndex = Math.max(0, Math.min(job.checkpointIndex, totalItems));
    let processedInThisRun = 0;
    let stopReason: 'timeout' | 'max-items' | null = null;

    try {
      for (let index = checkpointIndex; index < totalItems; index += 1) {
        if (Date.now() - startedAt >= normalized.timeoutMs) {
          stopReason = 'timeout';
          break;
        }
        if (processedInThisRun >= normalized.maxItems) {
          stopReason = 'max-items';
          break;
        }

        await this.processPromptImportResult(parsed[index] ?? {});
        checkpointIndex = index + 1;
        processedInThisRun += 1;

        await this.prisma.prompt_import_job.update({
          where: { runId },
          data: {
            checkpointIndex,
            processedItems: checkpointIndex,
            dateUpdated: new Date(),
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown prompt import error';
      await this.prisma.prompt_import_job.update({
        where: { runId },
        data: {
          status: 'FAILED',
          checkpointIndex,
          processedItems: checkpointIndex,
          lastError: message,
          dateUpdated: new Date(),
        },
      });
      return legacyError(`Exception occurred while importing result: ${message}`);
    }

    const completed = checkpointIndex >= totalItems;
    await this.prisma.prompt_import_job.update({
      where: { runId },
      data: {
        status: completed ? 'COMPLETED' : 'CHECKPOINTED',
        checkpointIndex,
        processedItems: checkpointIndex,
        lastError: null,
        dateUpdated: new Date(),
        dateFinished: completed ? new Date() : null,
      },
    });

    const status = await this.getPromptImportStatus(runId);
    if (completed) {
      return legacySuccess(status.result, 'Updated car detail');
    }

    return legacySuccess(
      {
        ...(status.result as Record<string, unknown>),
        stopReason,
        processedInThisRun,
      },
      'Checkpoint saved. Resume by reusing the same runId',
    );
  }

  async getPromptImportStatus(runIdInput: string) {
    const runId = this.toSafeString(runIdInput);
    if (!runId) {
      return legacyError('runId is required', 400);
    }

    const job = await this.prisma.prompt_import_job.findUnique({
      where: { runId },
    });
    if (!job) {
      return legacyError('Prompt import run not found', 404);
    }

    const result = {
      runId: job.runId,
      status: job.status,
      totalItems: job.totalItems,
      checkpointIndex: job.checkpointIndex,
      processedItems: job.processedItems,
      remainingItems: Math.max(job.totalItems - job.checkpointIndex, 0),
      dateCreated: job.dateCreated,
      dateUpdated: job.dateUpdated,
      dateFinished: job.dateFinished,
      lastError: job.lastError,
    };
    return legacySuccess(result, 'Prompt import status loaded');
  }

  async cleanCache() {
    const apiKey = this.toSafeString(
      process.env.NEXTJS_CACHE_API_KEY ??
        process.env.NEXT_CACHE_API_KEY ??
        process.env.CACHE_API_KEY,
    );
    if (!apiKey) {
      return legacyError('Failed to clean cache');
    }

    const endpoint =
      this.toSafeString(process.env.BASE_URL) || 'http://localhost:3000';

    const recentlyDeleted = await this.prisma.post.findMany({
      where: {
        deleted: true,
        dateUpdated: {
          gte: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        },
      },
      select: { id: true },
      take: 1000,
    });

    const ids = recentlyDeleted.map((row) => String(row.id)).join(',');
    const url = new URL('/api/cache', endpoint);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('postIds', ids);

    try {
      const response = await fetch(url.toString(), { method: 'GET' });
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // keep raw text
      }
      return legacySuccess(parsed, 'Cache cleaned successfully');
    } catch {
      return legacyError('Failed to clean cache');
    }
  }

  private normalizePromptImportOptions(
    options?: PromptImportOptions,
  ): Required<PromptImportOptions> {
    const timeoutMs = this.toBoundedInt(
      options?.timeoutMs,
      DEFAULT_PROMPT_IMPORT_TIMEOUT_MS,
      5_000,
      120_000,
    );
    const maxItems = this.toBoundedInt(
      options?.maxItems,
      DEFAULT_PROMPT_IMPORT_MAX_ITEMS,
      1,
      5_000,
    );

    return {
      runId: this.toSafeString(options?.runId),
      timeoutMs,
      maxItems,
    };
  }

  private toBoundedInt(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = this.toNullableInt(value);
    if (parsed === null) return fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
  }

  private generatePromptImportRunId(): string {
    return `prompt-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async processPromptImportResult(result: Record<string, unknown>) {
    const id = this.toSafeString(result.id);
    if (!id) return;

    const model = this.toSafeNullableString(result.model);
    const make = this.toSafeNullableString(result.make);
    const sold = this.booleanFrom(result.sold, false);
    if ((!model && !make) || sold) {
      await this.prisma.post.update({
        where: { id: BigInt(id) },
        data: { deleted: true, dateUpdated: new Date() },
      });
      await this.prisma.car_detail.updateMany({
        where: {
          OR: [{ id: BigInt(id) }, { post_id: BigInt(id) }],
        },
        data: { deleted: true, dateUpdated: new Date() },
      });
      return;
    }

    const postId = BigInt(id);
    // Prefer the row linked by post_id because /post/posts reads from that relation.
    const carDetail =
      (await this.prisma.car_detail.findFirst({
        where: { post_id: postId },
        orderBy: [{ dateUpdated: 'desc' }, { id: 'desc' }],
      })) ??
      (await this.prisma.car_detail.findUnique({
        where: { id: postId },
      }));
    if (!carDetail) return;

    await this.prisma.car_detail.update({
      where: { id: carDetail.id },
      data: {
        make: make ?? carDetail.make,
        model: model ?? carDetail.model,
        variant: this.toSafeNullableString(result.variant) ?? carDetail.variant,
        registration:
          (this.toNullableInt(result.registration)?.toString() ??
            this.toSafeNullableString(result.registration)) ??
          carDetail.registration,
        mileage: this.toNullableFloat(result.mileage) ?? carDetail.mileage,
        transmission:
          this.toSafeNullableString(result.transmission) ??
          carDetail.transmission,
        fuelType: this.toSafeNullableString(result.fuelType) ?? carDetail.fuelType,
        engineSize:
          this.toSafeNullableNumericString(result.engineSize) ??
          carDetail.engineSize,
        drivetrain:
          this.toSafeNullableString(result.drivetrain) ?? carDetail.drivetrain,
        seats: this.toNullableInt(result.seats) ?? carDetail.seats,
        numberOfDoors:
          this.toNullableInt(result.numberOfDoors) ?? carDetail.numberOfDoors,
        bodyType: this.toSafeNullableString(result.bodyType) ?? carDetail.bodyType,
        price: this.toNullableFloat(result.price) ?? carDetail.price,
        sold: this.booleanFrom(result.sold, carDetail.sold ?? false),
        customsPaid: this.resolveCustomsPaid(result),
        priceVerified: this.booleanFrom(
          result.priceVerified,
          carDetail.priceVerified ?? false,
        ),
        mileageVerified: this.booleanFrom(
          result.mileageVerified,
          carDetail.mileageVerified ?? false,
        ),
        fuelVerified: this.booleanFrom(
          result.fuelVerified,
          carDetail.fuelVerified ?? false,
        ),
        contact: result.contact ? JSON.stringify(result.contact) : carDetail.contact,
        published: true,
        type: this.toSafeString(result.type) || carDetail.type,
        dateUpdated: new Date(),
      },
    });

    const postUpdateData = sanitizePostUpdateDataForSource(
      {
        live: true,
        revalidate: false,
        origin: this.toSafeString(result.origin) || undefined,
        status: this.toSafeString(result.status) || undefined,
        renewTo: this.toNullableInt(result.renewTo) ?? undefined,
        highlightedTo: this.toNullableInt(result.highlightedTo) ?? undefined,
        promotionTo: this.toNullableInt(result.promotionTo) ?? undefined,
        mostWantedTo: this.toNullableInt(result.mostWantedTo) ?? undefined,
        dateUpdated: new Date(),
      },
      'untrusted',
    );
    await this.prisma.post.update({
      where: { id: BigInt(id) },
      data: postUpdateData,
    });
  }

  private async generateVariantPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const problematicMakes = await this.promptRepository.findVariantProblematicMakes();

    const chunkSize = Math.max(1, length);
    for (const makeRow of problematicMakes) {
      const make = this.toSafeString(makeRow.make);
      if (!make) continue;

      const models = await this.promptRepository.findMakeModels(make);
      if (models.length === 0) continue;

      const problems = await this.promptRepository.findVariantProblemsByMake(make);

      if (problems.length === 0) continue;

      const baseModels = models
        .filter((m) => Number(m.isVariant ?? 0) === 0 && m.model)
        .map((m) => this.toSafeString(m.model).replace(' (all)', ''))
        .filter(Boolean);
      const variants = models
        .filter((m) => Number(m.isVariant ?? 0) !== 0 && m.model)
        .map((m) => this.toSafeString(m.model).replace(' (all)', ''))
        .filter(Boolean);

      const chunks: string[][] = [];
      let buffer: string[] = [];
      for (const item of problems) {
        buffer.push(
          JSON.stringify({
            id: String(item.id),
            make: this.toSafeString(item.make),
            model: this.toSafeString(item.model),
            variant: this.toSafeString(item.variant),
            bodyType: this.toSafeString(item.bodyType),
            fuelType: this.toSafeString(item.fuelType),
            engineSize: item.engineSize,
          }),
        );
        if (buffer.length === chunkSize) {
          chunks.push(buffer);
          buffer = [];
        }
      }
      if (buffer.length > 0) chunks.push(buffer);

      const firstPromptData = chunks[0] ?? [];
      const listPrompt = this.normalizePromptWhitespace(
        `[${firstPromptData.join(', ')}]`,
      );

      const modelFixTemplate = `Hello. I want you to process a list of JSON objects.
        I want you to keep the same structure but map the model property to one of these: [{models}].
        {variantPrompt}
        Copy the id as string.
        Fill bodyType, fuelType and engineSize based on the model and variant values.
        If the type is car, body type should be one of: [Compact, Convertible, Coupe, SUV/Off-Road/Pick-up, Station wagon, Sedans, Van, Transporter, Other].
        If the type is motorcycle, body type should be one of: [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others].        Fuel type should be one of: petrol, petrol-gas, gas, diesel, electric, hybrid.
        Engine size should be a float number.`;

      const variantPrompt = variants.length
        ? `Try to map the variant to one of these: ${variants.join(', ')}.`
        : '';
      const modelFixPrompt = modelFixTemplate
        .replace('{models}', baseModels.join(', '))
        .replace('{variantPrompt}', variantPrompt);

      return {
        prompt: `${modelFixPrompt} Here is another list. Please do the same: ${listPrompt}`,
        size: problems.length,
      };
    }

    return { prompt: '', size: 0 };
  }

  private async generateGeneralPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `Can you please provide details in a JSON list containing the following fields: 
    id: as string, 
    make: Try to map the model to the official one. Use autoscout24.com for reference, 
    model: Try to map the model to the official one. Use autoscout24.com for reference. Model should not include variant like CDI, TDI, L, d, i, ci etc., 
    variant: Try to map the variant to the official one,
    registration: only the year as number, 
    mileage: only number, 
    bodyType: string,
    price: only number, 
    transmission: automatic, manual or semi-automatic
    fuelType: petrol, petrol-gas, gas, diesel, electric or hybrid
    engineSize: only float number, 
    emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6
    drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
    type: car, motorcycle, truck, boat, other
    and contact: {
        phone_number: as string,
        whatsapp: as string,
        address: as string
    }. 
    If the type is car, body type should be one of: [Compact, Convertible, Coupe, SUV/Off-Road/Pick-up, Station wagon, Sedans, Van, Transporter, Other].
    If the type is motorcycle, body type should be one of: [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others].
    Try to fill the unknown values based on your knowledge of the make and model. 
`;
    const rows = await this.promptRepository.findGeneralPromptRows();
    const captions = rows.map(
      (row) =>
        `" id: ${String(row.id)} - ${this.toSafeString(row.cleanedCaption)}"`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateRegistrationPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the contact information, add numberOfDoors and seats. 
    For contact information, try to fill address, phone_number and whatsapp based on caption.
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            contact: {phone_number: string, whatsapp: string, address: string},
            numberOfDoors: int,
            seats: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
            drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
            engineSize: float,
        }. `;
    const rows = await this.promptRepository.findRegistrationPromptRows();
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , contact: ${this.toSafeString(row.contact)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateMileagePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the mileage information. 
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            mileage: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
        }. `;
    const rows = await this.promptRepository.findMileagePromptRows();
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , registration: ${this.toSafeString(row.registration)}
                            , fuelType: ${this.toSafeString(row.fuelType)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generatePricePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the price information. 
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            price: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
        }. `;
    const rows = await this.promptRepository.findPricePromptRows();
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , registration: ${this.toSafeString(row.registration)}
                            , fuelType: ${this.toSafeString(row.fuelType)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateMotorcyclePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the contact information and other details. 
    For contact information, try to fill address, phone_number and whatsapp based on caption.
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            contact: {phone_number: string, whatsapp: string, address: string},
            numberOfDoors: int,
            seats: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
            drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
            engineSize: float,
            bodyType: one of [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others] 
        }. `;
    const rows = await this.promptRepository.findMotorcyclePromptRows();
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , contact: ${this.toSafeString(row.contact)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private buildFirstPromptChunk(captions: string[], maxLength: number): string {
    if (captions.length === 0) return '';
    const prompts: string[] = [];
    let current: string[] = [];
    for (const caption of captions) {
      current.push(caption);
      if (current.join(', ').length > maxLength) {
        current.pop();
        prompts.push(`[${current.join(', ')}]`);
        current = [caption];
      }
    }
    prompts.push(`[${current.join(', ')}]`);
    return this.normalizePromptWhitespace(prompts[0] ?? '[]');
  }

  private normalizePromptWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toSafeNullableString(value: unknown): string | null {
    const text = this.toSafeString(value);
    return text || null;
  }

  private toSafeNullableNumericString(value: unknown): string | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : null;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return this.toSafeNullableString(value);
  }

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.trunc(number);
  }

  private toNullableFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number;
  }

  private booleanFrom(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (['1', 'true', 'yes'].includes(lowered)) return true;
      if (['0', 'false', 'no'].includes(lowered)) return false;
    }
    return fallback;
  }

  private nullableBooleanFrom(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (['1', 'true', 'yes'].includes(lowered)) return true;
      if (['0', 'false', 'no'].includes(lowered)) return false;
    }
    return null;
  }

  private resolveCustomsPaid(result: Record<string, unknown>): boolean | null {
    const caption =
      this.toSafeNullableString(result.caption) ??
      this.toSafeNullableString(result.cleanedCaption);
    const inferred = isCustomsPaid(caption);
    if (Object.prototype.hasOwnProperty.call(result, 'customsPaid')) {
      const explicit = this.nullableBooleanFrom(result.customsPaid);
      if (explicit === true) {
        return true;
      }
      if (explicit === false) {
        // If payload sends false but caption has no customs signal, treat as unknown.
        return inferred === null ? null : false;
      }
      return inferred;
    }
    return inferred;
  }

  private toNullableBigInt(value: unknown): bigint | null {
    const asTimestampSeconds = this.toUnixSeconds(value);
    if (asTimestampSeconds === null) return null;
    try {
      return BigInt(asTimestampSeconds);
    } catch {
      return null;
    }
  }

  private toUnixSeconds(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'bigint') {
      const asNumber = Number(value);
      if (!Number.isFinite(asNumber)) return null;
      return this.normalizeEpochSeconds(asNumber);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return this.normalizeEpochSeconds(value);
    }

    const text = this.toSafeString(value);
    if (!text) return null;

    // Numeric string (seconds/ms)
    if (/^\d+(\.\d+)?$/.test(text)) {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return null;
      return this.normalizeEpochSeconds(parsed);
    }

    // ISO date string or any Date.parse-compatible string
    const parsedMs = Date.parse(text);
    if (!Number.isFinite(parsedMs)) return null;
    return this.normalizeEpochSeconds(parsedMs);
  }

  private normalizeEpochSeconds(value: number): number | null {
    if (!Number.isFinite(value) || value <= 0) return null;

    // Treat large epochs as milliseconds and normalize to seconds.
    const seconds = value > 1e12 ? Math.trunc(value / 1000) : Math.trunc(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (key === 'caption' && typeof value === 'string') {
          return decodeCaption(value);
        }
        return value;
      }),
    ) as T;
  }
}
