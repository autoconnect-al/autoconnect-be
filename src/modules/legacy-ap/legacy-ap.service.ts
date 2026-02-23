import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { LegacyDataService } from '../legacy-data/legacy-data.service';
import { LegacySitemapService } from '../legacy-sitemap/legacy-sitemap.service';
import { Resend } from 'resend';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class LegacyApService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyDataService: LegacyDataService,
    private readonly legacySitemapService: LegacySitemapService,
  ) {}

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

  private toObject(value: unknown): AnyRecord {
    if (!value || typeof value !== 'object') return {};
    return value as AnyRecord;
  }

  private toSafeString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
