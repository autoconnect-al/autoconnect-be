import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class ApVendorManagementService {
  constructor(private readonly prisma: PrismaService) {}

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

    const vendorPosts = await this.prisma.post.findMany({
      where: { vendor_id: vendorId },
      select: { id: true },
    });
    const postIds = vendorPosts.map((item) => item.id);

    await this.prisma.post.updateMany({
      where: { vendor_id: vendorId },
      data: { deleted, dateUpdated: new Date() },
    });
    if (postIds.length > 0) {
      await this.prisma.car_detail.updateMany({
        where: { post_id: { in: postIds } },
        data: { deleted, dateUpdated: new Date() },
      });
    }

    return legacySuccess(null, 'Vendor marked for crawl next');
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
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
