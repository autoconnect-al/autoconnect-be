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
import { Resend } from 'resend';
import { decodeCaption } from '../imports/utils/caption-processor';
import { createLogger } from '../../common/logger.util';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class LegacyApService {
  private readonly logger = createLogger('legacy-ap-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly localPostOrderService: LocalPostOrderService,
    private readonly localUserVendorService: LocalUserVendorService,
    private readonly legacyDataService: LegacyDataService,
    private readonly legacySitemapService: LegacySitemapService,
  ) {}

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

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.trunc(number);
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
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown rebuild error';
          this.logger.error('rebuild-search.upsert-failed', {
            postId: String(post.id),
            message,
          });
        }
      }

      lastSeenId = posts[posts.length - 1]?.id ?? null;
    }

    // Remove stale search rows within the managed horizon that were not refreshed in this run.
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
