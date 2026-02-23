import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { decodeCaption } from '../imports/utils/caption-processor';
import { createLogger } from '../../common/logger.util';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class ApPostToolingService {
  private readonly logger = createLogger('ap-post-tooling-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly localPostOrderService: LocalPostOrderService,
  ) {}

  async savePost(rawBody: unknown) {
    return this.localPostOrderService.createPost(rawBody);
  }

  async updatePostById(id: string, rawBody: unknown) {
    const payload = (rawBody ?? {}) as AnyRecord;
    const post = ((payload.post ?? {}) as AnyRecord) || {};
    if (!post.id) {
      post.id = id;
    }
    const merged = {
      ...payload,
      post,
    };
    return this.localPostOrderService.updatePost(merged);
  }

  async getPostsByIds(ids?: string) {
    if (ids === undefined || ids === null) {
      return legacyError(
        'ERROR: Something went wrong! TreguMakinave\\Service\\PostService::getByIds(): Argument #1 ($ids) must be of type string, null given, called in /var/www/backend_admin/controller/AdminPostController.php on line 31',
        500,
      );
    }

    const list = ids
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => /^\d+$/.test(value))
      .map((value) => BigInt(value));

    if (list.length === 0) return legacySuccess([]);

    const rows = await this.prisma.post.findMany({
      where: {
        id: { in: list },
      },
      include: {
        vendor: true,
        car_detail_post_car_detail_idTocar_detail: true,
        car_detail_car_detail_post_idTopost: true,
      },
    });

    const mapped = rows.map((row) => {
      const details =
        row.car_detail_post_car_detail_idTocar_detail ??
        row.car_detail_car_detail_post_idTopost?.find(
          (item) => item.id === row.car_detail_id,
        ) ??
        row.car_detail_car_detail_post_idTopost?.[0] ??
        null;
      return this.normalizeBigInts({
        id: row.id,
        caption: row.caption
          ? Buffer.from(row.caption, 'base64').toString('utf8')
          : row.caption,
        cleanedCaption: row.cleanedCaption,
        sidecarMedias: row.sidecarMedias,
        createdTime: row.createdTime,
        likesCount: row.likesCount,
        viewsCount: row.viewsCount,
        status: row.status,
        origin: row.origin,
        make: details?.make ?? null,
        model: details?.model ?? null,
        variant: details?.variant ?? null,
        registration: details?.registration ?? null,
        price: details?.price ?? null,
        mileage: details?.mileage ?? null,
        fuelType: details?.fuelType ?? null,
        engineSize: details?.engineSize ?? null,
        sold: details?.sold ?? null,
        contact: details?.contact ?? null,
        transmission: details?.transmission ?? null,
        drivetrain: details?.drivetrain ?? null,
        seats: details?.seats ?? null,
        numberOfDoors: details?.numberOfDoors ?? null,
        bodyType: details?.bodyType ?? null,
        customsPaid: details?.customsPaid ?? null,
        type: details?.type ?? null,
        vendorId: row.vendor?.id ?? row.vendor_id,
        accountName: row.vendor?.accountName ?? null,
        profilePicture: row.vendor?.profilePicture ?? null,
        biography: row.vendor?.biography ?? null,
        vendorContact: row.vendor?.contact ?? null,
        priceVerified: details?.priceVerified ?? null,
        mileageVerified: details?.mileageVerified ?? null,
        fuelVerified: details?.fuelVerified ?? null,
        revalidate: row.revalidate,
      });
    });
    return legacySuccess(mapped);
  }

  async createScrapeStatus(vendorAccountName?: string) {
    if (!vendorAccountName) {
      return legacyError('Could not create scrape status');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { accountName: vendorAccountName },
      select: { id: true },
    });
    if (!vendor) {
      return legacyError('Could not create scrape status');
    }

    const id = await this.generateImportStatusId();
    await this.prisma.import_status.create({
      data: {
        id,
        deleted: false,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        entity: 'post',
        status: 'NOT_STARTED',
        progress: '0%',
        vendorAccountName,
      },
    });

    return legacySuccess(String(id), 'Scrape status created successfully');
  }

  async getScrapeStatus() {
    const latest = await this.prisma.import_status.findFirst({
      where: { entity: 'post', deleted: false },
      orderBy: [{ dateCreated: 'desc' }, { id: 'desc' }],
    });

    if (!latest) {
      return legacyError(
        'Could not load scrape status. Maybe no scraping has been started yet',
      );
    }

    return legacySuccess({
      importStatus: latest.status,
      importPercentage: latest.progress,
      vendor: latest.vendorAccountName,
    });
  }

  async updateScrapeStatus(rawBody: unknown) {
    const payload = (rawBody ?? {}) as AnyRecord;
    const id = Number(payload.id ?? NaN);
    const progress = this.toSafeString(payload.progress);
    const status = this.toSafeString(payload.status);
    if (!Number.isInteger(id)) {
      return legacyError('Could not update scrape status');
    }

    await this.prisma.import_status.update({
      where: { id },
      data: {
        progress: progress || '0%',
        status: status || 'NOT_STARTED',
        dateUpdated: new Date(),
      },
    });

    return legacySuccess(null, 'Scrape status updated successfully');
  }

  async scrapePostsForVendors() {
    return legacySuccess(true, 'Scrape started successfully');
  }

  async cleanPosts() {
    await this.prisma.post.updateMany({
      where: {
        deleted: false,
        dateUpdated: {
          lt: new Date(Date.now() - 180 * 24 * 3600 * 1000),
        },
      },
      data: { deleted: true, dateUpdated: new Date() },
    });
    return legacySuccess(null, 'Posts cleaned successfully');
  }

  async movePostsToSearch() {
    await this.rebuildSearchFromPosts();
    return legacySuccess(null, 'Posts moved to search successfully');
  }

  async runCommonDetailsFix() {
    await this.prisma.$executeRaw`
      UPDATE car_detail
      SET type = 'car'
      WHERE (type IS NULL OR type = '') AND deleted = 0
    `;
    return legacySuccess(null, 'Common details fixed successfully');
  }

  async getMostLikedPosts() {
    const rows = await this.prisma.post.findMany({
      where: { deleted: false },
      orderBy: [{ likesCount: 'desc' }, { dateUpdated: 'desc' }],
      take: 100,
    });
    return legacySuccess(rows.map((row) => this.normalizeBigInts(row)));
  }

  async autoRenewPosts() {
    const now = Math.floor(Date.now() / 1000);
    const plus14days = now + 14 * 24 * 3600;

    await this.prisma.post.updateMany({
      where: {
        deleted: false,
        renewInterval: { not: null },
        OR: [{ renewTo: null }, { renewTo: { lt: now } }],
      },
      data: {
        renewTo: plus14days,
        renewedTime: now,
      },
    });

    await this.rebuildSearchFromPosts();
    return legacySuccess(null, 'Posts renewed successfully');
  }

  private generateId(length: number, onlyNumbers = true): string {
    const chars = onlyNumbers
      ? '0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let output = '';
    for (let index = 0; index < length; index += 1) {
      output += chars[Math.floor(Math.random() * chars.length)] ?? '0';
    }
    return output;
  }

  private async generateImportStatusId(): Promise<number> {
    for (let index = 0; index < 50; index += 1) {
      const id = Number(this.generateId(8, true));
      const existing = await this.prisma.import_status.findUnique({
        where: { id },
      });
      if (!existing) return id;
    }

    return Math.floor(Date.now() / 1000);
  }

  private async rebuildSearchFromPosts(): Promise<void> {
    const runStartedAt = new Date();
    const horizon = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const batchSize = 500;
    let lastSeenId: bigint | null = null;

    while (true) {
      const posts = await this.prisma.post.findMany({
        where: {
          deleted: false,
          dateCreated: { gte: horizon },
          ...(lastSeenId ? { id: { gt: lastSeenId } } : {}),
        },
        include: {
          vendor: true,
          car_detail_car_detail_post_idTopost: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
      });

      if (posts.length === 0) {
        break;
      }
      const publishedPostIds: bigint[] = [];

      for (const post of posts) {
        const details = post.car_detail_car_detail_post_idTopost?.[0];
        if (!details || details.deleted) continue;
        const { minPrice, maxPrice } =
          await this.calculateSearchPriceRange(details);

        const searchWriteData = {
          dateUpdated: runStartedAt,
          deleted: details.sold ? '1' : '0',
          caption: post.caption,
          cleanedCaption: post.cleanedCaption ?? '',
          createdTime: this.toNullableBigInt(post.createdTime),
          sidecarMedias: post.sidecarMedias,
          likesCount: post.likesCount,
          viewsCount: post.viewsCount,
          accountName: post.vendor.accountExists ? post.vendor.accountName : null,
          vendorId: post.vendor_id,
          profilePicture: post.vendor.accountExists
            ? post.vendor.profilePicture
            : null,
          make: details.make,
          model: details.model,
          variant: details.variant,
          registration: details.registration,
          mileage: details.mileage ? Math.trunc(details.mileage) : null,
          price: details.price ? Math.trunc(details.price) : null,
          transmission: details.transmission,
          fuelType: details.fuelType,
          engineSize: details.engineSize,
          drivetrain: details.drivetrain,
          seats: details.seats,
          numberOfDoors: details.numberOfDoors,
          bodyType: details.bodyType,
          emissionGroup: details.emissionGroup,
          contact: details.contact,
          customsPaid: details.customsPaid,
          sold: details.sold,
          type: details.type,
          promotionTo: post.promotionTo,
          highlightedTo: post.highlightedTo,
          renewTo: post.renewTo,
          renewInterval: post.renewInterval,
          renewedTime:
            post.renewedTime ?? Number.parseInt(post.createdTime ?? '0', 10),
          mostWantedTo: post.mostWantedTo,
          minPrice,
          maxPrice,
        };

        try {
          await this.prisma.search.upsert({
            where: { id: post.id },
            update: searchWriteData,
            create: {
              id: post.id,
              dateCreated: post.dateCreated,
              ...searchWriteData,
            },
          });
          publishedPostIds.push(post.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown rebuild error';
          this.logger.error('rebuild-search.upsert-failed', {
            postId: String(post.id),
            message,
          });
        }
      }

      if (publishedPostIds.length > 0) {
        await this.prisma.post.updateMany({
          where: {
            id: { in: publishedPostIds },
            status: 'TO_BE_PUBLISHED',
          },
          data: {
            status: 'PUBLISHED',
            dateUpdated: runStartedAt,
          },
        });
      }

      lastSeenId = posts[posts.length - 1]?.id ?? null;
    }

    await this.prisma.search.deleteMany({
      where: {
        dateCreated: { gte: horizon },
        dateUpdated: { lt: runStartedAt },
      },
    });
  }

  private async calculateSearchPriceRange(
    details: AnyRecord,
  ): Promise<{ minPrice: number | null; maxPrice: number | null }> {
    const registration = this.toNullableInt(details.registration);
    const currentPrice = this.toNullableInt(details.price);
    if (!registration || !currentPrice || currentPrice === 0) {
      return { minPrice: null, maxPrice: null };
    }

    const make = this.toSafeString(details.make);
    const model = this.toSafeString(details.model);
    if (!make || !model) {
      return { minPrice: null, maxPrice: null };
    }

    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`CAST(p.createdTime AS UNSIGNED) > ${oneYearAgo}`,
      Prisma.sql`cd.price > 0`,
      Prisma.sql`cd.make = ${make}`,
      Prisma.sql`cd.model = ${model}`,
      Prisma.sql`(cd.customsPaid = 1 OR cd.customsPaid IS NULL)`,
    ];

    const variantCondition = await this.buildVariantPriceRangeCondition(
      make,
      this.toSafeNullableString(details.variant),
    );
    if (variantCondition) {
      conditions.push(variantCondition);
    }

    conditions.push(Prisma.sql`cd.registration >= ${String(registration - 1)}`);
    conditions.push(Prisma.sql`cd.registration <= ${String(registration + 1)}`);

    const fuelType = this.toSafeNullableString(details.fuelType);
    if (fuelType) {
      conditions.push(Prisma.sql`cd.fuelType = ${fuelType}`);
    }

    const bodyType = this.toSafeNullableString(details.bodyType);
    if (bodyType) {
      conditions.push(Prisma.sql`cd.bodyType = ${bodyType}`);
    }

    const whereSql = Prisma.join(conditions, ' AND ');
    const similarRows = await this.prisma.$queryRaw<
      Array<{ price: number | null }>
    >(Prisma.sql`
      SELECT cd.price
      FROM post p
      LEFT JOIN car_detail cd ON cd.post_id = p.id
      LEFT JOIN vendor v ON v.id = p.vendor_id
      WHERE ${whereSql}
    `);

    const prices = similarRows
      .map((row) => this.toNullableInt(row.price))
      .filter((value): value is number => value !== null);

    if (prices.length < 3) {
      return { minPrice: null, maxPrice: null };
    }

    const minKnownPrice = Math.min(...prices);
    const maxKnownPrice = Math.max(...prices);
    let minPrice: number | null = null;
    let maxPrice: number | null = null;

    if (minKnownPrice !== maxKnownPrice) {
      minPrice = minKnownPrice;
      maxPrice = maxKnownPrice;
    }
    if (currentPrice < minKnownPrice) {
      minPrice = currentPrice;
    }
    if (currentPrice > maxKnownPrice) {
      maxPrice = currentPrice;
    }

    return { minPrice, maxPrice };
  }

  private async buildVariantPriceRangeCondition(
    make: string,
    variant: string | null,
  ): Promise<Prisma.Sql | null> {
    if (!variant) return null;
    if (!['mercedes-benz', 'bmw', 'volkswagen'].includes(make.toLowerCase())) {
      return null;
    }

    const modelRows = await this.prisma.$queryRaw<
      Array<{
        Model: string | null;
        isVariant: number | boolean | string | null;
      }>
    >(Prisma.sql`SELECT Model, isVariant FROM car_make_model WHERE Make = ${make}`);

    const normalizedVariant = variant.replace(/\s+/g, '-').toLowerCase();
    for (const row of modelRows) {
      const model = this.toSafeString(row.Model);
      if (!model) continue;
      const normalizedModel = model.replace(/\s+/g, '-').toLowerCase();
      const isVariant =
        row.isVariant === true ||
        row.isVariant === 1 ||
        row.isVariant === '1';
      if (isVariant && normalizedVariant.includes(normalizedModel)) {
        return Prisma.sql`(cd.variant LIKE ${`% ${model} %`} OR cd.variant LIKE ${`${model} %`})`;
      }
    }

    return null;
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toSafeNullableString(value: unknown): string | null {
    const text = this.toSafeString(value);
    return text || null;
  }

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.trunc(number);
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

    if (/^\d+(\.\d+)?$/.test(text)) {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return null;
      return this.normalizeEpochSeconds(parsed);
    }

    const parsedMs = Date.parse(text);
    if (!Number.isFinite(parsedMs)) return null;
    return this.normalizeEpochSeconds(parsedMs);
  }

  private normalizeEpochSeconds(value: number): number | null {
    if (!Number.isFinite(value) || value <= 0) return null;

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
