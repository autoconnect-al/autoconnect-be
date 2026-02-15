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
import { decodeCaption } from '../imports/utils/caption-processor';

type AnyRecord = Record<string, unknown>;
type PromptRow = Record<string, unknown>;

@Injectable()
export class LegacyApService {
  private readonly jwtService: JwtService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly localPostOrderService: LocalPostOrderService,
    private readonly localUserVendorService: LocalUserVendorService,
    private readonly legacyDataService: LegacyDataService,
    private readonly legacySitemapService: LegacySitemapService,
  ) {
    this.jwtService = new JwtService({
      secret:
        process.env.JWT_SECRET ??
        `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgHhtbw0Ojj24oDS1NFTg4jJaNNulbn1tAYlgTaoua1Fogkmtbhed
p3wMaJu0PHrCNM4DZeBA1XxpQcDuTSLukkSVRGqRsrSB3UyRfc3ykINN0/nQmTvh
C3WxyOF/xTAfa3r4d/aMs+knBtBvXR8NS6C6Nfd+eSr3mfMlPB31Sfn7AgMBAAEC
gYA2+zeFTYzxbvZtugE/c0CyXm7djSTpzLez4azzsqe6ji1VuAGYdJj/0KZ92Ab4
wOvc1r5PaSpO17t2exXqieNrF+GTM2t0e8IjjuI65wcWLtmmorSgxOaix2Ytww9m
7VSvjjkjMSXFKssmhrnnHwu5+Bi74xoQRQf/G9k3OsSZoQJBAOgfSqVwZGnaU6yi
bAQwW900XT7gDLr7gXQWzAGdvSIUYh2Elrr+rcXrlZ+xPRbsTTLIlmtmeqo9kCwe
d7B2fpECQQCE0MWQgBZHrfePHta7zU7XGTZBUljhMVVOldTEALVVhTBBn6kA62V8
iKOudmJX9AtPe6aITBzKK+qcTI1UIk3LAkEAt9mxAgBXSBAJHj83VsoGuNn00Qwc
iS0Th6NWyiDp4MhMPhz6VfnKIW1LAUUcob9gFc0SdtagaZ6BRrCLFFWGQQJAD1fa
6vWRHVjAl50Va36tU/YKqYMs118OntR6TuZSDH4lc/9Q09Vd1QQn/JiahdSgld8P
/wDj9osaQFIrpYOM/wJAWW38Ogcp70SPtAyV1kl4jP38jyXFD+M3VESBrhZRzz5E
F4RzDtfTdh+Oy9rr11Fr9HvlTQeNhBTTOc4veOpd3A==
-----END RSA PRIVATE KEY-----`,
      signOptions: { algorithm: 'HS256' },
    });
  }

  async loginWithCode(code: string): Promise<LegacyResponse> {
    const expected = process.env.CODE ?? process.env.AP_ADMIN_CODE ?? '';
    if (!expected || code !== expected) {
      return legacyError(
        'Could not login user. Please check your credentials.',
        500,
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

  async getUsers() {
    const users = await this.prisma.user.findMany({
      where: { deleted: false },
      orderBy: { dateCreated: 'desc' },
      take: 500,
    });
    const roleMap = await this.getRoleMap(users.map((row) => row.id));
    return legacySuccess(users.map((row) => this.mapUser(row, roleMap)));
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    if (!user || user.deleted) {
      return legacyError(`No user could be found for id: ${id}`);
    }
    const roleMap = await this.getRoleMap([user.id]);
    return legacySuccess(this.mapUser(user, roleMap), id);
  }

  async getUserByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deleted: false },
    });
    if (!user) {
      return legacyError(`No user could be found for username: ${username}`);
    }

    const roleMap = await this.getRoleMap([user.id]);
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return legacyError(`Could not delete user.`);
    }

    if (!user.deleted) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { deleted: true, dateUpdated: new Date() },
      });
    } else {
      await this.prisma.user.delete({ where: { id: userId } });
    }

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
        "ERROR: Something went wrong! TreguMakinave\\Service\\PostService::getByIds(): Argument #1 ($ids) must be of type string, null given, called in /var/www/backend_admin/controller/AdminPostController.php on line 31",
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
        car_detail_car_detail_post_idTopost: true,
      },
    });

    const mapped = rows.map((row) => {
      const details = row.car_detail_car_detail_post_idTopost?.[0] ?? null;
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
        price: details?.price ?? null,
        mileage: details?.mileage ?? null,
        fuelType: details?.fuelType ?? null,
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

    const modeQueryMap: Record<
      string,
      { rows: PromptRow[]; prerequisite: string }
    > = {
      general: {
        rows: await this.prisma.$queryRawUnsafe<PromptRow[]>(
          `
          SELECT p.id, p.cleanedCaption
          FROM post p
          LEFT JOIN car_detail cd ON cd.post_id = p.id
          WHERE (cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)
            AND (cd.sold = 0 OR cd.sold IS NULL)
            AND (cd.deleted = 0 OR cd.deleted IS NULL)
            AND LOWER(COALESCE(p.origin, '')) IN ('manual', 'instagram', 'encar')
          ORDER BY p.dateCreated DESC
          LIMIT 500
          `,
        ),
        prerequisite:
          'Can you please provide details in a JSON list containing fields: id, make, model, variant, registration, mileage, bodyType, price, transmission, fuelType, engineSize, emissionGroup, drivetrain, type and contact.',
      },
      registration: {
        rows: await this.prisma.$queryRawUnsafe<PromptRow[]>(
          `
          SELECT cd.id, cd.make, cd.model, cd.contact, p.cleanedCaption
          FROM post p
          LEFT JOIN car_detail cd ON cd.post_id = p.id
          WHERE cd.deleted = 0
            AND cd.published = 1
            AND cd.sold = 0
            AND cd.type = 'car'
            AND p.deleted = 0
            AND p.live = 1
            AND LOWER(COALESCE(p.origin, '')) <> 'manual'
            AND p.createdTime >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 MONTH))
            AND (
              cd.contact IS NULL OR cd.contact NOT LIKE '%{%' OR
              cd.drivetrain IS NULL OR cd.drivetrain = '' OR
              cd.numberOfDoors IS NULL OR cd.seats IS NULL
            )
          ORDER BY p.dateUpdated DESC
          LIMIT 500
          `,
        ),
        prerequisite:
          'I would like you to fix contact, numberOfDoors and seats using caption context.',
      },
      mileage: {
        rows: await this.prisma.$queryRawUnsafe<PromptRow[]>(
          `
          SELECT cd.id, cd.make, cd.model, cd.registration, cd.fuelType, p.cleanedCaption
          FROM car_detail cd
          LEFT JOIN post p ON cd.post_id = p.id
          WHERE p.createdTime >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 MONTH))
            AND cd.deleted = 0
            AND cd.published = 1
            AND p.deleted = 0
            AND p.live = 1
            AND cd.sold = 0
            AND LOWER(COALESCE(p.origin, '')) <> 'manual'
            AND cd.mileage > 0
            AND cd.mileage < 1000
            AND (cd.mileageVerified = 0 OR cd.mileageVerified IS NULL)
          ORDER BY p.dateUpdated DESC
          LIMIT 500
          `,
        ),
        prerequisite:
          'I would like you to fix mileage information using caption context.',
      },
      price: {
        rows: await this.prisma.$queryRawUnsafe<PromptRow[]>(
          `
          SELECT cd.id, cd.make, cd.model, cd.registration, cd.fuelType, p.cleanedCaption
          FROM car_detail cd
          LEFT JOIN post p ON cd.post_id = p.id
          WHERE p.createdTime >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 MONTH))
            AND cd.deleted = 0
            AND cd.published = 1
            AND p.deleted = 0
            AND p.live = 1
            AND cd.sold = 0
            AND p.vendor_id <> 1
            AND LOWER(COALESCE(p.origin, '')) <> 'manual'
            AND cd.price > 0
            AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
          ORDER BY p.dateUpdated DESC
          LIMIT 500
          `,
        ),
        prerequisite:
          'I would like you to fix price information using caption context.',
      },
      motorcycle: {
        rows: await this.prisma.$queryRawUnsafe<PromptRow[]>(
          `
          SELECT cd.id, cd.make, cd.model, cd.contact, p.cleanedCaption
          FROM post p
          LEFT JOIN car_detail cd ON p.id = cd.post_id
          WHERE cd.deleted = 0
            AND cd.published = 1
            AND p.deleted = 0
            AND p.live = 1
            AND cd.type = 'motorcycle'
            AND LOWER(COALESCE(p.origin, '')) <> 'manual'
            AND p.createdTime >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 MONTH))
            AND (
              cd.contact IS NULL OR cd.contact NOT LIKE '%{%' OR
              cd.drivetrain IS NULL OR cd.drivetrain = '' OR
              cd.numberOfDoors IS NULL OR cd.seats IS NULL
            )
          ORDER BY p.dateUpdated DESC
          LIMIT 500
          `,
        ),
        prerequisite:
          'I would like you to fix motorcycle contact and base details using caption context.',
      },
    };

    const bucket = modeQueryMap[modeNormalized] ?? modeQueryMap.general;
    const compactList = this.buildPromptList(bucket.rows, safeLength);
    const fullPrompt = compactList
      ? `${bucket.prerequisite} Here is another list: ${compactList}`
      : '';

    return {
      prompt: fullPrompt,
      size: bucket.rows.length,
    };
  }

  async getManualDraftPosts() {
    const rows = await this.prisma.post.findMany({
      where: {
        deleted: false,
        OR: [{ origin: 'MANUAL' }, { status: 'DRAFT' }],
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
      if (!model && !make) {
        await this.prisma.post.update({
          where: { id: BigInt(id) },
          data: { deleted: true, dateUpdated: new Date() },
        });
        await this.prisma.car_detail.updateMany({
          where: { id: BigInt(id) },
          data: { deleted: true, dateUpdated: new Date() },
        });
        continue;
      }

      const carDetail = await this.prisma.car_detail.findUnique({
        where: { id: BigInt(id) },
      });
      if (!carDetail) continue;

      await this.prisma.car_detail.update({
        where: { id: carDetail.id },
        data: {
          make: make ?? carDetail.make,
          model: model ?? carDetail.model,
          variant:
            this.toSafeNullableString(result.variant) ?? carDetail.variant,
          registration:
            this.toSafeNullableString(result.registration) ??
            carDetail.registration,
          mileage: this.toNullableFloat(result.mileage) ?? carDetail.mileage,
          transmission:
            this.toSafeNullableString(result.transmission) ??
            carDetail.transmission,
          fuelType:
            this.toSafeNullableString(result.fuelType) ?? carDetail.fuelType,
          engineSize:
            this.toSafeNullableString(result.engineSize) ??
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
          customsPaid: this.booleanFrom(
            result.customsPaid,
            carDetail.customsPaid ?? false,
          ),
          contact: result.contact
            ? JSON.stringify(result.contact)
            : carDetail.contact,
          published: true,
          type: this.toSafeString(result.type) || carDetail.type,
          dateUpdated: new Date(),
        },
      });

      await this.prisma.post.update({
        where: { id: BigInt(id) },
        data: {
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
      });
    }

    await this.rebuildSearchFromPosts();
    return legacySuccess(null, 'Updated car detail');
  }

  async cleanCache() {
    const apiKey = this.toSafeString(process.env.NEXTJS_CACHE_API_KEY);
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
      if (!response.ok) {
        return legacyError('Failed to clean cache');
      }
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
    const problematicRows = await this.prisma.$queryRawUnsafe<
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
      SELECT cd.id, cd.make, cd.model, cd.variant, cd.bodyType, cd.fuelType, cd.engineSize
      FROM car_detail cd
      LEFT JOIN post p ON p.id = cd.post_id
      WHERE p.createdTime >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 MONTH))
        AND p.deleted = 0
        AND p.live = 1
        AND cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND p.vendor_id <> 1
        AND (
          cd.bodyType IS NULL OR cd.fuelType IS NULL OR cd.engineSize IS NULL
          OR cd.engineSize > 10 OR cd.model IS NULL OR cd.model = 'Other'
        )
      ORDER BY p.dateUpdated DESC
      LIMIT 500
      `,
    );

    if (problematicRows.length === 0) {
      return { prompt: '', size: 0 };
    }

    const firstMake = this.toSafeString(problematicRows[0]?.make);
    const makeModels = firstMake
      ? await this.prisma.$queryRawUnsafe<
          Array<{ Model: string | null; isVariant: boolean | number | null }>
        >(
          'SELECT Model, isVariant FROM car_make_model WHERE Make = ? ORDER BY id ASC',
          firstMake,
        )
      : [];

    const baseModels = makeModels
      .filter((row) => Number(row.isVariant ?? 0) === 0 && row.Model)
      .map((row) => this.toSafeString(row.Model).replace(' (all)', ''))
      .filter(Boolean);
    const variants = makeModels
      .filter((row) => Number(row.isVariant ?? 0) === 1 && row.Model)
      .map((row) => this.toSafeString(row.Model).replace(' (all)', ''))
      .filter(Boolean);

    const payloadRows = problematicRows
      .filter((row) => this.toSafeString(row.make) === firstMake)
      .map((row) => ({
        id: String(row.id),
        make: row.make,
        model: row.model,
        variant: row.variant,
        bodyType: row.bodyType,
        fuelType: row.fuelType,
        engineSize: row.engineSize,
      }));

    const listPrompt = this.buildPromptList(payloadRows, length);
    const variantPart = variants.length
      ? ` Try to map the variant to one of these: [${variants.join(', ')}].`
      : '';

    const prompt = `Hello. I want you to process a list of JSON objects. Keep the same structure but map model to one of these: [${baseModels.join(', ')}].${variantPart} Fill bodyType, fuelType and engineSize based on model/variant. Here is another list: ${listPrompt}`;
    return {
      prompt,
      size: problematicRows.length,
    };
  }

  private buildPromptList(rows: PromptRow[], maxLength: number): string {
    if (!rows.length) return '';
    const chunks: string[] = [];
    for (const row of rows) {
      chunks.push(JSON.stringify(this.normalizeBigInts(row)));
      const joined = chunks.join(', ');
      if (joined.length > maxLength) {
        chunks.pop();
        break;
      }
    }
    return `[${chunks.join(', ')}]`;
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
      Array<{ user_id: bigint; role_id: number; role_name: string }>
    >(
      `
      SELECT ur.user_id, ur.role_id, r.name as role_name
      FROM user_role ur
      INNER JOIN role r ON r.id = ur.role_id
      WHERE ur.user_id IN (${userIds.map(() => '?').join(',')})
      `,
      ...userIds,
    );

    for (const row of rows) {
      const key = String(row.user_id);
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
      where: { deleted: false },
      include: {
        vendor: true,
        car_detail_car_detail_post_idTopost: true,
      },
      take: 5000,
    });

    await this.prisma.search.deleteMany({});

    for (const post of posts) {
      const details = post.car_detail_car_detail_post_idTopost?.[0];
      if (!details || details.deleted) continue;

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
            accountName: post.vendor.accountName,
            vendorId: post.vendor_id,
            profilePicture: post.vendor.profilePicture,
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
            renewedTime: post.renewedTime,
            mostWantedTo: post.mostWantedTo,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown rebuild error';
        console.error(
          JSON.stringify({
            scope: 'legacy-ap-service',
            event: 'rebuild-search.create-failed',
            postId: String(post.id),
            message,
          }),
        );
      }
    }
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
