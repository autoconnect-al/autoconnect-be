import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LegacyDataService } from '../legacy-data/legacy-data.service';
import { LegacySitemapService } from '../legacy-sitemap/legacy-sitemap.service';
import { JwtService } from '@nestjs/jwt';
import { Resend } from 'resend';
import { decodeCaption, isCustomsPaid } from '../imports/utils/caption-processor';
import { requireEnv } from '../../common/require-env.util';
import { sanitizePostUpdateDataForSource } from '../../common/promotion-field-guard.util';
import { createLogger } from '../../common/logger.util';

type AnyRecord = Record<string, unknown>;

const jwtSecret = requireEnv('JWT_SECRET');
const adminLoginCode = requireEnv('AP_ADMIN_CODE');

@Injectable()
export class LegacyApService {
  private readonly jwtService: JwtService;
  private readonly logger = createLogger('legacy-ap-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly localPostOrderService: LocalPostOrderService,
    private readonly localUserVendorService: LocalUserVendorService,
    private readonly legacyDataService: LegacyDataService,
    private readonly legacySitemapService: LegacySitemapService,
  ) {
    this.jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: { algorithm: 'HS256' },
    });
  }

  async loginWithCode(code: string): Promise<LegacyResponse> {
    if (code !== adminLoginCode) {
      return legacyError(
        'Could not login user. Please check your credentials.',
        401,
      );
    }

    const jwt = await this.jwtService.signAsync({
      iat: Math.floor(Date.now() / 1000),
      iss: 'your.domain.name',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      userId: 'ADMIN',
      roles: ['ADMIN'],
      name: 'ADMIN',
    });
    return legacySuccess(jwt);
  }

  async getRoles() {
    const rows = await this.prisma.role.findMany({
      where: { deleted: false },
      orderBy: { id: 'asc' },
    });
    return legacySuccess(rows.map((row) => this.normalizeBigInts(row)));
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: Number(id) },
    });
    if (!role || role.deleted) {
      return legacyError(`No user could be found for id: ${id}`);
    }
    return legacySuccess(this.normalizeBigInts(role), id);
  }

  async createRole(rawRole: unknown) {
    const role = this.extractRole(rawRole);
    if (!role?.name) return legacyError('Entity could not be added');

    const existing = await this.prisma.role.findFirst({
      where: {
        name: role.name,
        deleted: false,
      },
    });
    if (existing) return legacyError('Entity could not be added');

    await this.prisma.role.create({
      data: {
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        name: role.name,
      },
    });
    return legacySuccess(true);
  }

  async updateRole(id: string, rawRole: unknown) {
    const role = this.extractRole(rawRole);
    if (!role?.name) return legacyError('Role could not be added');

    const roleId = Number(id);
    if (!Number.isInteger(roleId))
      return legacyError('Role could not be added');

    const existing = await this.prisma.role.findFirst({
      where: {
        id: { not: roleId },
        name: role.name,
        deleted: false,
      },
    });
    if (existing) return legacyError('Role could not be added');

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: role.name,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(true);
  }

  async deleteRole(id: string) {
    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return legacyError('Entity id could not be found in the request.');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        deleted: true,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(id);
  }

  async grantAdminRole(userId: string) {
    const parsedUserId = this.parseNumericId(userId);
    if (!parsedUserId) {
      return legacyError('Invalid user id.', 400);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: parsedUserId },
      select: { id: true, deleted: true },
    });
    if (!vendor || vendor.deleted) {
      return legacyError('User not found.', 404);
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'ADMIN', deleted: false },
      select: { id: true },
    });
    if (!adminRole) {
      return legacyError('ADMIN role is not configured.', 500);
    }

    await this.prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
      parsedUserId,
      adminRole.id,
    );

    return legacySuccess(true, 'Admin role granted successfully');
  }

  async revokeAdminRole(userId: string) {
    const parsedUserId = this.parseNumericId(userId);
    if (!parsedUserId) {
      return legacyError('Invalid user id.', 400);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: parsedUserId },
      select: { id: true, deleted: true },
    });
    if (!vendor || vendor.deleted) {
      return legacyError('User not found.', 404);
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'ADMIN', deleted: false },
      select: { id: true },
    });
    if (!adminRole) {
      return legacyError('ADMIN role is not configured.', 500);
    }

    const adminLinks = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE role_id = ?',
      adminRole.id,
    );
    const totalAdmins = Number(adminLinks[0]?.total ?? 0n);

    const targetLink = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      parsedUserId,
      adminRole.id,
    );
    const targetHasAdmin = Number(targetLink[0]?.total ?? 0n) > 0;

    if (targetHasAdmin && totalAdmins <= 1) {
      return legacyError('Cannot remove the last ADMIN user.', 409);
    }

    await this.prisma.$executeRawUnsafe(
      'DELETE FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      parsedUserId,
      adminRole.id,
    );

    return legacySuccess(true, 'Admin role revoked successfully');
  }

  async getUsers() {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE deleted = 0
      ORDER BY dateCreated DESC
      LIMIT 500
      `,
    );
    const roleMap = await this.getRoleMap(
      users.map((row) => BigInt(String(row.id))),
    );
    return legacySuccess(users.map((row) => this.mapUser(row, roleMap)));
  }

  async getUserById(id: string) {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE id = ? AND deleted = 0
      LIMIT 1
      `,
      BigInt(id),
    );
    const user = users[0];
    if (!user) {
      return legacyError(`No user could be found for id: ${id}`);
    }
    const roleMap = await this.getRoleMap([BigInt(String(user.id))]);
    return legacySuccess(this.mapUser(user, roleMap), id);
  }

  async getUserByUsername(username: string) {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE username = ? AND deleted = 0
      LIMIT 1
      `,
      username,
    );
    const user = users[0];
    if (!user) {
      return legacyError(`No user could be found for username: ${username}`);
    }

    const roleMap = await this.getRoleMap([BigInt(String(user.id))]);
    return legacySuccess(this.mapUser(user, roleMap), username);
  }

  async createUser(rawUser: unknown) {
    return this.localUserVendorService.createUser(rawUser);
  }

  async updateUser(id: string, rawUser: unknown) {
    return this.localUserVendorService.updateUser(id, rawUser);
  }

  async deleteUser(id: string) {
    const userId = BigInt(id);
    const vendor = await this.prisma.vendor.findUnique({ where: { id: userId } });
    if (!vendor) {
      return legacyError(`Could not delete user.`);
    }

    await this.prisma.vendor.update({
      where: { id: userId },
      data: { deleted: true, dateUpdated: new Date() },
    });

    return legacySuccess(id);
  }

  async updateVendorByAdmin(id: string, rawVendor: unknown) {
    const vendor = this.extractVendor(rawVendor);
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: {
        biography: vendor.biography,
        contact: vendor.contact ? JSON.stringify(vendor.contact) : undefined,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(null, 'Vendor updated successfully');
  }

  async deleteVendorByAdmin(id: string) {
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: { deleted: true, dateUpdated: new Date() },
    });
    return legacySuccess(null, 'Vendor deleted successfully');
  }

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
    await this.prisma.$executeRawUnsafe(
      "UPDATE car_detail SET type = 'car' WHERE (type IS NULL OR type = '') AND deleted = 0",
    );
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

  async getVendors() {
    const rows = await this.prisma.vendor.findMany({
      orderBy: [{ deleted: 'asc' }, { dateUpdated: 'asc' }],
      take: 1000,
    });
    return legacySuccess(rows.map((row) => this.normalizeBigInts(row)));
  }

  async addVendor(id: string) {
    const vendorId = BigInt(id);
    const existing = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!existing) {
      await this.prisma.vendor.create({
        data: {
          id: vendorId,
          dateCreated: new Date(),
          deleted: false,
          accountExists: false,
          initialised: false,
          profilePicture: '',
          accountName: `new vendor ${id}`,
          biography: '',
          contact: '{"phone_number": "", "email": "", "whatsapp": ""}',
        },
      });
    }
    return legacySuccess(null, 'Vendor added successfully');
  }

  async addVendorDetails(id: string, rawBody: unknown) {
    const payload = (rawBody ?? {}) as AnyRecord;
    const account = this.parseJsonObject(payload.account);

    const updates: Record<string, unknown> = {
      accountExists: true,
      dateUpdated: new Date(),
    };

    if (account) {
      const username = this.toSafeString(account.username);
      if (username) updates.accountName = username;
      const profilePicUrl = this.toSafeString(account.profilePicUrl);
      if (profilePicUrl) updates.profilePicture = profilePicUrl;
    }

    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: updates,
    });

    return legacySuccess(null, 'Vendor added successfully');
  }

  async editVendor(id: string, rawVendor: unknown) {
    const vendor = this.extractVendor(rawVendor);
    const values: Record<string, unknown> = {
      dateUpdated: new Date(),
    };

    if (vendor.accountName) values.accountName = vendor.accountName;
    if (vendor.biography) values.biography = vendor.biography;
    if (vendor.contact) values.contact = JSON.stringify(vendor.contact);
    if (vendor.profilePicture) values.profilePicture = vendor.profilePicture;

    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: values,
    });
    return legacySuccess(null, 'Vendor updated successfully');
  }

  async getNextVendorToCrawl() {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        deleted: false,
        accountExists: true,
      },
      orderBy: [{ dateUpdated: 'asc' }, { dateCreated: 'asc' }],
    });
    return legacySuccess(this.normalizeBigInts(vendor));
  }

  async markVendorForCrawlNext(id: string) {
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: { dateUpdated: null },
    });
    return legacySuccess(null, 'Vendor marked for crawl next');
  }

  async toggleVendorDeleted(id: string) {
    const vendorId = BigInt(id);
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) return legacyError('Could not mark vendor for crawl next');

    const deleted = !vendor.deleted;
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deleted,
        dateUpdated: new Date(),
      },
    });

    if (deleted) {
      const vendorPosts = await this.prisma.post.findMany({
        where: { vendor_id: vendorId },
        select: { id: true },
      });
      const postIds = vendorPosts.map((item) => item.id);

      await this.prisma.post.updateMany({
        where: { vendor_id: vendorId },
        data: { deleted: true, dateUpdated: new Date() },
      });
      if (postIds.length > 0) {
        await this.prisma.car_detail.updateMany({
          where: { post_id: { in: postIds } },
          data: { deleted: true, dateUpdated: new Date() },
        });
      }
    } else {
      const vendorPosts = await this.prisma.post.findMany({
        where: { vendor_id: vendorId },
        select: { id: true },
      });
      const postIds = vendorPosts.map((item) => item.id);

      await this.prisma.post.updateMany({
        where: { vendor_id: vendorId },
        data: { deleted: false, dateUpdated: new Date() },
      });
      if (postIds.length > 0) {
        await this.prisma.car_detail.updateMany({
          where: { post_id: { in: postIds } },
          data: { deleted: false, dateUpdated: new Date() },
        });
      }
    }

    return legacySuccess(null, 'Vendor marked for crawl next');
  }

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

  async importPromptResults(resultJson: string) {
    let parsed: Array<Record<string, unknown>> = [];
    try {
      const value = JSON.parse(resultJson);
      if (Array.isArray(value)) {
        parsed = value as Array<Record<string, unknown>>;
      }
    } catch {
      return legacyError('Exception occurred while importing result');
    }

    for (const result of parsed) {
      const id = this.toSafeString(result.id);
      if (!id) continue;

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
        continue;
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
      if (!carDetail) continue;

      await this.prisma.car_detail.update({
        where: { id: carDetail.id },
        data: {
          make: make ?? carDetail.make,
          model: model ?? carDetail.model,
          variant:
            this.toSafeNullableString(result.variant) ?? carDetail.variant,
          registration:
            (this.toNullableInt(result.registration)?.toString() ??
              this.toSafeNullableString(result.registration)) ??
            carDetail.registration,
          mileage: this.toNullableFloat(result.mileage) ?? carDetail.mileage,
          transmission:
            this.toSafeNullableString(result.transmission) ??
            carDetail.transmission,
          fuelType:
            this.toSafeNullableString(result.fuelType) ?? carDetail.fuelType,
          engineSize:
            this.toSafeNullableNumericString(result.engineSize) ??
            carDetail.engineSize,
          drivetrain:
            this.toSafeNullableString(result.drivetrain) ??
            carDetail.drivetrain,
          seats: this.toNullableInt(result.seats) ?? carDetail.seats,
          numberOfDoors:
            this.toNullableInt(result.numberOfDoors) ?? carDetail.numberOfDoors,
          bodyType:
            this.toSafeNullableString(result.bodyType) ?? carDetail.bodyType,
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
          contact: result.contact
            ? JSON.stringify(result.contact)
            : carDetail.contact,
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

    // await this.rebuildSearchFromPosts();
    return legacySuccess(null, 'Updated car detail');
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

  async makeModelMakes(type: 'car' | 'motorcycle') {
    return this.legacyDataService.makes(type);
  }

  async makeModelModels(make: string, type: 'car' | 'motorcycle') {
    return this.legacyDataService.models(make, type, true);
  }

  async articleAll() {
    const articles = await this.prisma.article.findMany({
      where: { deleted: false },
      orderBy: { dateUpdated: 'desc' },
      take: 500,
    });
    return legacySuccess(articles.map((row) => this.normalizeBigInts(row)));
  }

  async articleRead(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    return legacySuccess(this.normalizeBigInts(article));
  }

  async articleCreate(raw: unknown) {
    const payload = this.toObject(raw);
    const id = this.generateId(10, false);
    const image = this.toSafeString(payload.image);
    const created = await this.prisma.article.create({
      data: {
        id,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        title: this.extractArticleTitle(payload.data),
        category: this.toSafeString(payload.category),
        data: this.stringifyData(payload.data),
        image,
        appName: this.toSafeString(payload.appName) || 'autoconnect',
      },
    });
    return legacySuccess(this.normalizeBigInts(created));
  }

  async articleUpdate(id: string, raw: unknown) {
    const payload = this.toObject(raw);
    const image = this.toSafeString(payload.image);

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        category: this.toSafeString(payload.category),
        appName: this.toSafeString(payload.appName) || 'autoconnect',
        data: this.stringifyData(payload.data),
        title: this.extractArticleTitle(payload.data),
        image: image.startsWith('media/') ? undefined : image,
        dateUpdated: new Date(),
      },
    });

    return legacySuccess(this.normalizeBigInts(updated));
  }

  async sitemapGenerate() {
    await this.legacySitemapService.getDefaultSitemap();
    return legacySuccess(true, 'Sitemap generated successfully');
  }

  async sendRemindEmails() {
    const now = Date.now();
    const threeDayUpper = new Date(now - 11 * 24 * 3600 * 1000);
    const threeDayLower = new Date(now - 12 * 24 * 3600 * 1000);
    const oneDayUpper = new Date(now - 14 * 24 * 3600 * 1000);
    const oneDayLower = new Date(now - 15 * 24 * 3600 * 1000);

    const [threeDayOrders, oneDayOrders] = await Promise.all([
      this.prisma.customer_orders.findMany({
        where: {
          dateUpdated: {
            lte: threeDayUpper,
            gt: threeDayLower,
          },
          email: { not: null },
        },
      }),
      this.prisma.customer_orders.findMany({
        where: {
          dateUpdated: {
            lte: oneDayUpper,
            gt: oneDayLower,
          },
          email: { not: null },
        },
      }),
    ]);

    const apiKey = this.toSafeString(process.env.RESEND_API_KEY);
    const resend = apiKey ? new Resend(apiKey) : null;
    const sent = { oneDay: 0, threeDay: 0 };

    const sendBatch = async (
      rows: Array<{ email: string | null; postId: string | null }>,
      daysLeft: '1' | '3',
    ) => {
      for (const row of rows) {
        const email = this.toSafeString(row.email);
        const postId = this.toSafeString(row.postId);
        if (!email || !postId || !resend) continue;

        const link = `https://autoconnect.al/sq-al/automjete/makine-ne-shitje/${postId}`;
        try {
          await resend.emails.send({
            from: 'info@autoconnect.al',
            to: [email],
            subject: 'Promovimi i postimit tuaj skadon se shpejti',
            html: `
              <strong>Promovimi i postimit tuaj skadon se shpejti</strong>
              <p>Postimit tuaj i kane mbetur vetem ${daysLeft} dite nga promovimi aktiv.</p>
              <p><a href="${link}">Shiko postin</a></p>
              <p>Faleminderit,<br/>Ekipi i Autoconnect</p>
            `,
          });
          if (daysLeft === '1') sent.oneDay += 1;
          if (daysLeft === '3') sent.threeDay += 1;
        } catch {
          // Keep endpoint resilient; continue with next recipient.
        }
      }
    };

    await sendBatch(threeDayOrders, '3');
    await sendBatch(oneDayOrders, '1');

    return legacySuccess({
      oneDayCandidates: oneDayOrders.length,
      threeDayCandidates: threeDayOrders.length,
      sent,
      emailDeliveryEnabled: Boolean(resend),
    });
  }

  private async generateVariantPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const problematicMakes = await this.prisma.$queryRawUnsafe<
      Array<{ make: string | null }>
    >(
      `
      SELECT cd.make
      FROM car_detail cd
      LEFT JOIN post p ON p.id = post_id
      WHERE FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND p.deleted = 0
        AND p.live = 1
        AND cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND (
          (cd.model NOT IN (SELECT REPLACE(cmm.Model, ' (all)', '') FROM car_make_model cmm WHERE cmm.isVariant = 0) AND cd.model != 'Others')
          OR (
            cd.make IN ('Mercedes-Benz', 'BMW', 'Lexus', 'Porsche', 'Citroen')
            AND cd.variant NOT RLIKE (
              SELECT GROUP_CONCAT(REPLACE(cmm.Model, '  ', '') SEPARATOR '|')
              FROM car_make_model cmm
              WHERE cmm.Make = cd.make
                AND cmm.isVariant = 1
                AND (
                  cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), ' %')
                  OR cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), '%')
                )
            )
          )
          OR engineSize > 10
          OR bodyType IS NULL
          OR (
            type = 'car'
            AND bodyType NOT IN ('Compact', 'Convertible', 'Coupe', 'SUV/Off-Road/Pick-up', 'Station wagon', 'Sedans', 'Van', 'Transporter', 'Other')
          )
          OR (
            type = 'motorcycle'
            AND bodyType NOT IN ('Supersport', 'Sport touring', 'Chopper/Cruiser', 'Touring Enduro', 'Streetfighter', 'Enduro Bike', 'Motocrosser', 'Sidecar', 'Classic', 'Three Wheeler', 'Scooter', 'Moped', 'Super Moto', 'Minibike', 'Naked Bike', 'Quad', 'Rally', 'Trials Bike', 'Racing', 'Tourer', 'Others')
          )
          OR fuelType NOT IN ('petrol', 'petrol-gas', 'gas', 'diesel', 'electric', 'hybrid')
          OR fuelType IS NULL
        )
      ORDER BY cd.make
      `,
    );

    const chunkSize = Math.max(1, length);
    for (const makeRow of problematicMakes) {
      const make = this.toSafeString(makeRow.make);
      if (!make) continue;

      const models = await this.prisma.$queryRawUnsafe<
        Array<{ model: string | null; isVariant: number | boolean | null }>
      >(
        'SELECT DISTINCT model, isVariant FROM car_make_model WHERE make = ? ORDER BY id',
        make,
      );
      if (models.length === 0) continue;

      const problems = await this.prisma.$queryRawUnsafe<
        Array<{
          id: bigint;
          make: string | null;
          model: string | null;
          variant: string | null;
          bodyType: string | null;
          fuelType: string | null;
          engineSize: string | null;
        }>
      >(
        `
        SELECT cd.id, cd.make, cd.model, cd.variant, bodyType, fuelType, engineSize
        FROM car_detail cd
        LEFT JOIN post p ON p.id = post_id
        WHERE FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
          AND p.deleted = 0
          AND p.live = 1
          AND cd.deleted = 0
          AND cd.published = 1
          AND cd.sold = 0
          AND cd.make = ?
          AND p.vendor_id != 1
          AND (
            (cd.model NOT IN (SELECT REPLACE(cmm.Model, ' (all)', '') FROM car_make_model cmm WHERE cmm.Make = ? AND cmm.isVariant = 0) AND cd.model != 'Other')
            OR (
              cd.make IN ('Mercedes-Benz', 'BMW', 'Lexus', 'Porsche', 'Citroen')
              AND cd.variant IS NOT NULL
              AND cd.variant NOT RLIKE (
                SELECT GROUP_CONCAT(REPLACE(cmm.Model, '  ', '') SEPARATOR '|')
                FROM car_make_model cmm
                WHERE cmm.Make = cd.make
                  AND cmm.isVariant = 1
                  AND (
                    cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), ' %')
                    OR cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), '%')
                  )
              )
            )
            OR engineSize > 10
            OR bodyType IS NULL
            OR (
              type = 'car'
              AND bodyType NOT IN ('Compact', 'Convertible', 'Coupe', 'SUV/Off-Road/Pick-up', 'Station wagon', 'Sedans', 'Van', 'Transporter', 'Other')
            )
            OR (
              type = 'motorcycle'
              AND bodyType NOT IN ('Supersport', 'Sport touring', 'Chopper/Cruiser', 'Touring Enduro', 'Streetfighter', 'Enduro Bike', 'Motocrosser', 'Sidecar', 'Classic', 'Three Wheeler', 'Scooter', 'Moped', 'Super Moto', 'Minibike', 'Naked Bike', 'Quad', 'Rally', 'Trials Bike', 'Racing', 'Tourer', 'Others')
            )
            OR fuelType NOT IN ('petrol', 'petrol-gas', 'gas', 'diesel', 'electric', 'hybrid')
            OR fuelType IS NULL
          )
        `,
        make,
        make,
      );

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
            id: BigInt(item.id),
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
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: bigint; cleanedCaption: string | null }>
    >(
      `
      SELECT p.id, p.cleanedCaption
      FROM post p
      LEFT JOIN car_detail cd ON cd.post_id = p.id
      WHERE (cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)
        AND (cd.sold = 0 OR cd.sold IS NULL)
        AND (cd.deleted = 0 OR cd.deleted IS NULL)
        AND (p.origin = 'manual' OR p.origin = 'instagram')
        AND (p.deleted = 0 OR p.deleted IS NULL)
      ORDER BY p.dateCreated DESC
      `,
    );
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
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(
      `
      SELECT
        cd.id,
        cd.make,
        cd.model,
        p.cleanedCaption,
        cd.contact
      FROM post p
      JOIN car_detail cd ON cd.post_id = p.id
      WHERE
        cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND cd.type = 'car'
        AND p.deleted = 0
        AND p.live = 1
        AND p.origin <> 'manual'
        AND p.vendor_id <> 1
        AND p.createdTime >= UNIX_TIMESTAMP(NOW() - INTERVAL 3 MONTH)
        AND (
          p.status = 'DRAFT'
          OR cd.contact IS NULL
          OR cd.contact NOT LIKE '%{%'
          OR cd.contact LIKE '%unknown%'
          OR cd.contact LIKE '%provided%'
          OR cd.contact LIKE '%null%'
          OR cd.contact LIKE '%www%'
          OR cd.contact LIKE '%http%'
          OR (
            cd.contact LIKE '%"phone_number": "%'
            AND cd.contact NOT LIKE '%"phone_number": ""%'
            AND (
              (
                cd.contact NOT LIKE '%"phone_number": "+355%'
                AND cd.contact NOT LIKE '%"phone_number": "068%'
                AND cd.contact NOT LIKE '%"phone_number": "069%'
                AND cd.contact NOT LIKE '%"phone_number": "067%'
                AND cd.contact NOT LIKE '%"phone_number": "06%'
                AND cd.contact NOT LIKE '%"phone_number": "04%'
                AND cd.contact NOT LIKE '%"phone_number": "+49%'
                AND cd.contact NOT LIKE '%"phone_number": "+44%'
                AND cd.contact NOT LIKE '%"phone_number": "+82%'
                AND cd.contact NOT LIKE '%"phone_number": "+1%'
                AND cd.contact NOT LIKE '%"phone_number": "+39%'
                AND cd.contact NOT LIKE '%"phone_number": "+38%'
                AND cd.contact NOT LIKE '%"phone_number": "+97%'
                AND cd.contact NOT LIKE '%"phone_number": "+46%'
                AND cd.contact NOT LIKE '%"phone_number": "+43%'
                AND cd.contact NOT LIKE '%"phone_number": "+79%'
                AND cd.contact NOT LIKE '%"phone_number": "+34%'
                AND cd.contact NOT LIKE '%"phone_number": "+32%'
                AND cd.contact NOT LIKE '%"phone_number": "+30%'
                AND cd.contact NOT LIKE '%"phone_number": "+33%'
              )
              OR cd.contact LIKE '%"phone_number": "+35506%'
              OR cd.contact LIKE '%"phone_number": "+3869%'
              OR cd.contact LIKE '%"phone_number": "+3868%'
              OR cd.contact LIKE '%"phone_number": "+3867%'
              OR cd.contact LIKE '%"phone_number": "+3969%'
            )
          )
          OR cd.drivetrain IS NULL
          OR cd.drivetrain = ''
          OR cd.drivetrain NOT IN ('2WD','4WD','AWD','FWD','RWD','4x4')
          OR cd.numberOfDoors IS NULL
          OR cd.numberOfDoors = ''
          OR cd.seats IS NULL
          OR cd.seats = ''
          OR cd.bodyType IS NULL
          OR cd.bodyType = ''
          OR cd.bodyType = 'other'
          OR (
            cd.registration < 2022
            AND cd.mileage > 0
            AND cd.mileage < 10000
            AND (cd.mileageVerified = 0 OR cd.mileageVerified IS NULL)
          )
          OR (
            cd.registration < 2022
            AND cd.price > 0
            AND cd.price < 1100
            AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
          )
          OR (
            cd.registration < 2022
            AND cd.price > 100000
            AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
          )
          OR cd.variant LIKE '%viti%'
          OR cd.contact LIKE '%viti%'
          OR (
            cd.fuelType = 'diesel'
            AND (cd.fuelVerified = 0 OR cd.fuelVerified IS NULL)
            AND p.cleanedCaption NOT REGEXP '[0-9]+ *d'
            AND cd.model NOT REGEXP '[0-9]+ *d'
            AND cd.variant NOT REGEXP '[0-9]+ *d'
            AND (
              LOWER(p.cleanedCaption) NOT REGEXP '(naft(e|a)?|dizel|diezel|diesel|tdi|cdi|tdci|hdi|dci|cdti|jtd|multijet|crdi|d-4d|d4d|sdv6|tdv6|(^|[^a-z0-9])d4([^a-z0-9]|$))'
              AND LOWER(cd.variant) NOT REGEXP '(dizel|diezel|diesel|tdi|cdi|tdci|hdi|dci|cdti|jtd|multijet|crdi|d-4d|d4d|sdv6|tdv6|(^|[^a-z0-9])d4([^a-z0-9]|$))'
            )
          )
          OR (
            cd.fuelType = 'petrol'
            AND (cd.fuelVerified = 0 OR cd.fuelVerified IS NULL)
            AND p.cleanedCaption NOT REGEXP '[0-9]+ *(i|li)'
            AND cd.model NOT REGEXP '[0-9]+ *(i|li)'
            AND cd.variant NOT REGEXP '[0-9]+ *(i|li)'
            AND p.cleanedCaption NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND cd.model NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND cd.variant NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^a-z0-9])(amg|v8|v10|v12)([^a-z0-9]|$)'
            AND LOWER(cd.variant) NOT REGEXP '(^|[^a-z0-9])(amg|v8|v10|v12)([^a-z0-9]|$)'
            AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])(6\\.2|6\\.3|5\\.5|5\\.0|4\\.0)([^0-9]|$)'
            AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])(6\\.2|6\\.3|5\\.5|5\\.0|4\\.0)([^0-9]|$)'
            AND NOT (
              LOWER(cd.variant) REGEXP '(^|[^0-9])63([^0-9]|$)'
              AND LOWER(cd.variant) REGEXP 'amg'
            )
            AND (
              LOWER(p.cleanedCaption) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(cd.model) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(cd.variant) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
            )
          )
        )
      `,
    );
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
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(
      `
      SELECT
        p.id,
        p.cleanedCaption,
        cd.mileage,
        cd.price,
        cd.sold,
        cd.make,
        cd.model,
        cd.registration,
        cd.fuelType,
        cd.emissionGroup
      FROM car_detail cd
      LEFT JOIN post p ON cd.post_id = p.id
      WHERE
        FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.mileage > 0
        AND cd.mileage < 1000
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND (cd.mileageVerified = 0 OR cd.mileageVerified IS NULL)
        AND (
          cd.price = cd.mileage
          OR (
            p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.mileage, 0, 'de_DE'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.mileage, 0, 'en_US'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', cd.mileage, '%')
            AND REPLACE(p.cleanedCaption, ' ', '') NOT LIKE CONCAT('%', cd.mileage, '%')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*k([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*K([^a-zA-Z]|$)')
          )
        )
      ORDER BY cd.mileage
      `,
    );
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
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(
      `
      SELECT
        cd.id,
        p.cleanedCaption,
        cd.mileage,
        cd.price,
        cd.sold,
        cd.make,
        cd.model,
        cd.registration,
        cd.fuelType,
        cd.emissionGroup
      FROM car_detail cd
      LEFT JOIN post p ON cd.post_id = p.id
      LEFT JOIN vendor v ON v.id = p.vendor_id
      WHERE
        FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.price > 0
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND p.vendor_id != 1
        AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
        AND (
          cd.price = cd.mileage
          OR (
            p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.price, 0, 'de_DE'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.price, 0, 'en_US'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', cd.price, '%')
            AND REPLACE(p.cleanedCaption, ' ', '') NOT LIKE CONCAT('%', cd.price, '%')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*k([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*K([^a-zA-Z]|$)')
          )
        )
      ORDER BY cd.price
      `,
    );
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
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(
      `
      SELECT cd.id, cd.make, cd.model, p.cleanedCaption, cd.contact, cd.bodyType, cd.drivetrain, cd.numberOfDoors, cd.seats
      FROM post p
      LEFT JOIN car_detail cd ON p.id = cd.post_id
      WHERE cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.type = "motorcycle"
        AND p.origin != "manual"
        AND FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND (
          (cd.contact NOT LIKE "%{%" OR cd.contact IS NULL)
          OR (cd.drivetrain IS NULL OR cd.drivetrain = "" OR drivetrain NOT IN ("2WD", "4WD", "AWD", "FWD", "RWD", "4x4"))
          OR ((cd.numberOfDoors IS NULL OR cd.numberOfDoors = "" OR cd.numberOfDoors > 2) AND cd.numberOfDoors != 0)
          OR (cd.seats IS NULL OR cd.seats = "" OR cd.seats > 2)
        )
      `,
    );
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

  private toObject(value: unknown): AnyRecord {
    if (!value || typeof value !== 'object') return {};
    return value as AnyRecord;
  }

  private stringifyData(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(Array.isArray(value) ? value : []);
    } catch {
      return '[]';
    }
  }

  private extractArticleTitle(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) return '';
    const first = data[0];
    if (!first || typeof first !== 'object') return '';
    return this.toSafeString((first as AnyRecord).title);
  }

  private extractRole(rawRole: unknown): { id?: string; name: string } | null {
    const root = this.toObject(rawRole);
    const roleInput = root.role ?? root;

    if (typeof roleInput === 'string') {
      try {
        const parsed = JSON.parse(roleInput) as AnyRecord;
        return {
          id: this.toSafeString(parsed.id),
          name: this.toSafeString(parsed.name),
        };
      } catch {
        return null;
      }
    }

    if (!roleInput || typeof roleInput !== 'object') return null;
    const role = roleInput as AnyRecord;
    return {
      id: this.toSafeString(role.id),
      name: this.toSafeString(role.name),
    };
  }

  private extractVendor(rawVendor: unknown): {
    accountName: string;
    biography: string;
    profilePicture: string;
    contact: AnyRecord | null;
  } {
    const root = this.toObject(rawVendor);
    const source = root.vendor ?? root;
    const vendor =
      typeof source === 'string'
        ? (this.parseJsonObject(source) ?? {})
        : (source as AnyRecord);

    return {
      accountName: this.toSafeString(vendor.accountName),
      biography: this.toSafeString(vendor.biography),
      profilePicture: this.toSafeString(vendor.profilePicture),
      contact:
        vendor.contact && typeof vendor.contact === 'object'
          ? (vendor.contact as AnyRecord)
          : this.parseJsonObject(vendor.contact),
    };
  }

  private parseJsonObject(value: unknown): AnyRecord | null {
    if (!value) return null;
    if (typeof value === 'object') return value as AnyRecord;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as AnyRecord)
        : null;
    } catch {
      return null;
    }
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private parseNumericId(value: string): bigint | null {
    if (!/^\d+$/.test(value)) {
      return null;
    }
    try {
      return BigInt(value);
    } catch {
      return null;
    }
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

  private async getRoleMap(
    userIds: bigint[],
  ): Promise<Map<string, Array<{ id: number; name: string }>>> {
    const map = new Map<string, Array<{ id: number; name: string }>>();
    if (userIds.length === 0) return map;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ vendor_id: bigint; role_id: number; role_name: string }>
    >(
      `
      SELECT vr.vendor_id, vr.role_id, r.name as role_name
      FROM vendor_role vr
      INNER JOIN role r ON r.id = vr.role_id
      WHERE vr.vendor_id IN (${userIds.map(() => '?').join(',')})
      `,
      ...userIds,
    );

    for (const row of rows) {
      const key = String(row.vendor_id);
      const current = map.get(key) ?? [];
      current.push({ id: Number(row.role_id), name: row.role_name });
      map.set(key, current);
    }

    return map;
  }

  private mapUser(
    user: AnyRecord,
    roleMap: Map<string, Array<{ id: number; name: string }>>,
  ) {
    const id = String(user.id ?? '');
    return {
      id,
      name: this.toSafeString(user.name),
      username: this.toSafeString(user.username),
      email: this.toSafeString(user.email),
      phone: this.toSafeString(user.phone),
      whatsapp: this.toSafeString(user.whatsapp),
      location: this.toSafeString(user.location),
      roles: roleMap.get(id) ?? [{ id: 1, name: 'USER' }],
    };
  }

  private async rebuildSearchFromPosts(): Promise<void> {
    const posts = await this.prisma.post.findMany({
      where: {
        deleted: false,
        dateCreated: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
      },
      include: {
        vendor: true,
        car_detail_car_detail_post_idTopost: true,
      },
      take: 10000,
    });

    await this.prisma.search.deleteMany({});

    for (const post of posts) {
      const details = post.car_detail_car_detail_post_idTopost?.[0];
      if (!details || details.deleted) continue;
      const { minPrice, maxPrice } =
        await this.calculateSearchPriceRange(details);

      try {
        await this.prisma.search.create({
          data: {
            id: post.id,
            dateCreated: post.dateCreated,
            dateUpdated: new Date(),
            deleted: details.sold ? '1' : '0',
            caption: post.caption,
            cleanedCaption: post.cleanedCaption ?? '',
            createdTime: this.toNullableBigInt(post.createdTime),
            sidecarMedias: post.sidecarMedias,
            likesCount: post.likesCount,
            viewsCount: post.viewsCount,
            accountName: post.vendor.accountExists
              ? post.vendor.accountName
              : null,
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
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown rebuild error';
        this.logger.error('rebuild-search.create-failed', {
          postId: String(post.id),
          message,
        });
      }
    }
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
    const whereClauses = [
      'CAST(p.createdTime AS UNSIGNED) > ?',
      'cd.price > 0',
      'cd.make = ?',
      'cd.model = ?',
      '(cd.customsPaid = 1 OR cd.customsPaid IS NULL)',
    ];
    const params: unknown[] = [oneYearAgo, make, model];

    const variantCondition = await this.buildVariantPriceRangeCondition(
      make,
      this.toSafeNullableString(details.variant),
    );
    if (variantCondition) {
      whereClauses.push(variantCondition.clause);
      params.push(...variantCondition.params);
    }

    whereClauses.push('cd.registration >= ?');
    whereClauses.push('cd.registration <= ?');
    params.push(String(registration - 1), String(registration + 1));

    const fuelType = this.toSafeNullableString(details.fuelType);
    if (fuelType) {
      whereClauses.push('cd.fuelType = ?');
      params.push(fuelType);
    }

    const bodyType = this.toSafeNullableString(details.bodyType);
    if (bodyType) {
      whereClauses.push('cd.bodyType = ?');
      params.push(bodyType);
    }

    const similarRows = await this.prisma.$queryRawUnsafe<
      Array<{ price: number | null }>
    >(
      `
      SELECT cd.price
      FROM post p
      LEFT JOIN car_detail cd ON cd.post_id = p.id
      LEFT JOIN vendor v ON v.id = p.vendor_id
      WHERE ${whereClauses.join(' AND ')}
    `,
      ...params,
    );

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
  ): Promise<{ clause: string; params: string[] } | null> {
    if (!variant) return null;
    if (!['mercedes-benz', 'bmw', 'volkswagen'].includes(make.toLowerCase())) {
      return null;
    }

    const modelRows = await this.prisma.$queryRawUnsafe<
      Array<{
        Model: string | null;
        isVariant: number | boolean | string | null;
      }>
    >('SELECT Model, isVariant FROM car_make_model WHERE Make = ?', make);

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
        return {
          clause: '(cd.variant LIKE ? OR cd.variant LIKE ?)',
          params: [`% ${model} %`, `${model} %`],
        };
      }
    }

    return null;
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
