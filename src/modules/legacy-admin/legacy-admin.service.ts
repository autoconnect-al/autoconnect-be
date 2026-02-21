import { Injectable } from '@nestjs/common';
import { legacyError } from '../../common/legacy-response';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';
import { decodeCaption } from '../imports/utils/caption-processor';

@Injectable()
export class LegacyAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localUserVendorService: LocalUserVendorService,
    private readonly localPostOrderService: LocalPostOrderService,
  ) {}

  async getPosts(userId: string) {
    const rows = await this.prisma.search.findMany({
      where: { vendorId: BigInt(userId), deleted: '0' },
      orderBy: [{ createdTime: 'desc' }],
      take: 300,
    });
    const ids = rows.map((row) => row.id);
    const postStatuses =
      ids.length > 0
        ? await this.prisma.post.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              status: true,
              postOpen: true,
              impressions: true,
              reach: true,
              clicks: true,
              contact: true,
              contactCall: true,
              contactWhatsapp: true,
              contactEmail: true,
              contactInstagram: true,
            } as any,
          })
        : [];
    const metricsById = new Map(
      postStatuses.map((row) => [
        row.id.toString(),
        {
          status: row.status ?? '',
          postOpen: row.postOpen ?? 0,
          impressions: row.impressions ?? 0,
          reach: row.reach ?? 0,
          clicks: row.clicks ?? 0,
          contactCount: row.contact ?? 0,
          contactCall: row.contactCall ?? 0,
          contactWhatsapp: row.contactWhatsapp ?? 0,
          contactEmail: row.contactEmail ?? 0,
          contactInstagram: row.contactInstagram ?? 0,
        },
      ]),
    );

    const withStatus = rows.map((row) => ({
      ...row,
      ...(metricsById.get(row.id.toString()) ?? {
        status: '',
        postOpen: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        contactCount: 0,
        contactCall: 0,
        contactWhatsapp: 0,
        contactEmail: 0,
        contactInstagram: 0,
      }),
    }));

    return legacySuccess(this.normalizeBigInts(withStatus));
  }

  async getPostById(id: string, userId: string) {
    const row = await this.prisma.search.findFirst({
      where: { id: BigInt(id), vendorId: BigInt(userId), deleted: '0' },
    });
    if (!row) {
      return legacySuccess(this.normalizeBigInts(row));
    }

    const post = await this.prisma.post.findUnique({
      where: { id: BigInt(id) },
      select: {
        status: true,
        postOpen: true,
        impressions: true,
        reach: true,
        clicks: true,
        contact: true,
        contactCall: true,
        contactWhatsapp: true,
        contactEmail: true,
        contactInstagram: true,
      } as any,
    });

    return legacySuccess(
      this.normalizeBigInts({
        ...row,
        status: post?.status ?? '',
        postOpen: post?.postOpen ?? 0,
        impressions: post?.impressions ?? 0,
        reach: post?.reach ?? 0,
        clicks: post?.clicks ?? 0,
        contactCount: post?.contact ?? 0,
        contactCall: post?.contactCall ?? 0,
        contactWhatsapp: post?.contactWhatsapp ?? 0,
        contactEmail: post?.contactEmail ?? 0,
        contactInstagram: post?.contactInstagram ?? 0,
      }),
    );
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        whatsapp: true,
        location: true,
      },
    });
    if (!user) {
      return legacyError('ERROR: Not authorised', 401);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        accountExists: true,
        initialised: true,
        accountName: true,
        contact: true,
        profilePicture: true,
        biography: true,
        useDetailsForPosts: true,
      },
    });

    const userRecord = {
      id: String(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone ?? '',
      whatsapp: user.whatsapp ?? '',
      location: user.location ?? '',
    };

    const payload: Record<string, unknown> = {
      ...userRecord,
      user: userRecord,
      isVendor: Boolean(vendor?.accountExists),
    };

    if (vendor?.accountExists) {
      payload.vendor = {
        id: String(vendor.id),
        accountName: vendor.accountName ?? '',
        profilePicture: vendor.profilePicture ?? '',
        biography: vendor.biography ?? '',
        contact: vendor.contact ?? '',
        useDetailsForPosts: Boolean(vendor.useDetailsForPosts),
      };
    }

    return legacySuccess(payload);
  }

  editUser(id: string, user: unknown) {
    return this.localUserVendorService.updateUser(id, user);
  }

  changePassword(id: string, user: unknown) {
    return this.localUserVendorService.changePassword(id, user);
  }

  updateVendorContact(id: string, vendor: unknown) {
    return this.localUserVendorService.updateVendorContact(id, vendor);
  }

  updateVendorBiography(id: string, vendor: unknown) {
    return this.localUserVendorService.updateVendorBiography(id, vendor);
  }

  updateVendorProfilePicture(id: string, vendor: unknown) {
    return this.localUserVendorService.updateVendorProfilePicture(id, vendor);
  }

  deletePost(id: string, userId: string) {
    return this.localPostOrderService.markAsDeleted(id, userId);
  }

  markPostSold(id: string, userId: string) {
    return this.localPostOrderService.markAsSold(id, userId);
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
