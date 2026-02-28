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
    const rows = await this.prisma.post.findMany({
      where: { vendor_id: BigInt(userId), deleted: false },
      orderBy: [{ createdTime: 'desc' }],
      take: 300,
      include: {
        vendor: {
          select: {
            accountName: true,
            profilePicture: true,
            contact: true,
          },
        },
        car_detail_post_car_detail_idTocar_detail: true,
        car_detail_car_detail_post_idTopost: true,
      },
    } as any);

    return legacySuccess(
      this.normalizeBigInts(rows.map((row) => this.toAdminPostReadModel(row))),
    );
  }

  async getPostById(id: string, userId: string) {
    const row = await this.prisma.post.findFirst({
      where: { id: BigInt(id), vendor_id: BigInt(userId), deleted: false },
      include: {
        vendor: {
          select: {
            accountName: true,
            profilePicture: true,
            contact: true,
          },
        },
        car_detail_post_car_detail_idTocar_detail: true,
        car_detail_car_detail_post_idTopost: true,
      },
    } as any);
    if (!row) {
      return legacySuccess(this.normalizeBigInts(null));
    }

    return legacySuccess(this.normalizeBigInts(this.toAdminPostReadModel(row)));
  }

  async getUser(userId: string) {
    const authRows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        name: string | null;
        username: string | null;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        location: string | null;
      }>
    >(
      `
      SELECT
        id, name, username, email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE id = ? AND deleted = 0
      LIMIT 1
      `,
      BigInt(userId),
    );
    const user = authRows[0];
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

  private toAdminPostReadModel(row: any) {
    const details =
      row.car_detail_post_car_detail_idTocar_detail ??
      row.car_detail_car_detail_post_idTopost?.find(
        (item: any) => item.id === row.car_detail_id,
      ) ??
      row.car_detail_car_detail_post_idTopost?.find(
        (item: any) => item.post_id === row.id,
      ) ??
      row.car_detail_car_detail_post_idTopost?.[0] ??
      null;

    return {
      id: row.id,
      vendorId: row.vendor_id,
      deleted: row.deleted ? '1' : '0',
      caption: row.caption,
      cleanedCaption: row.cleanedCaption,
      createdTime: row.createdTime,
      sidecarMedias: row.sidecarMedias,
      likesCount: row.likesCount ?? 0,
      viewsCount: row.viewsCount ?? 0,
      accountName: row.vendor?.accountName ?? null,
      profilePicture: row.vendor?.profilePicture ?? null,
      vendorContact: row.vendor?.contact ?? null,
      make: details?.make ?? null,
      model: details?.model ?? null,
      variant: details?.variant ?? null,
      registration: details?.registration ?? null,
      mileage: details?.mileage ?? null,
      price: details?.price ?? null,
      transmission: details?.transmission ?? null,
      fuelType: details?.fuelType ?? null,
      engineSize: details?.engineSize ?? null,
      drivetrain: details?.drivetrain ?? null,
      seats: details?.seats ?? null,
      numberOfDoors: details?.numberOfDoors ?? null,
      bodyType: details?.bodyType ?? null,
      customsPaid: details?.customsPaid ?? null,
      canExchange: details?.canExchange ?? null,
      options: details?.options ?? null,
      emissionGroup: details?.emissionGroup ?? null,
      contact: details?.contact ?? null,
      sold: details?.sold ?? null,
      type: details?.type ?? null,
      promotionTo: row.promotionTo ?? null,
      highlightedTo: row.highlightedTo ?? null,
      renewTo: row.renewTo ?? null,
      renewInterval: row.renewInterval ?? null,
      renewedTime: row.renewedTime ?? null,
      mostWantedTo: row.mostWantedTo ?? null,
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
    };
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
