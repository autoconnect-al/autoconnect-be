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

    const visibleRows = rows
      .map((row) => {
        const details = this.resolveCarDetails(row);
        if (this.isDeletedPostGraph(row, details)) return null;
        return this.toAdminPostReadModel(row, details);
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const reviewCounts = await this.getReviewCountByPostIds(
      visibleRows.map((row) => String(row.id)),
    );
    const rowsWithReviewCount = visibleRows.map((row) => ({
      ...row,
      reviewsCount: reviewCounts.get(String(row.id)) ?? 0,
    }));

    return legacySuccess(
      this.normalizeBigInts(rowsWithReviewCount),
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

    const details = this.resolveCarDetails(row);
    if (this.isDeletedPostGraph(row, details)) {
      return legacySuccess(this.normalizeBigInts(null));
    }

    const reviewsCount = await this.getReviewCountByPostId(String(row.id));
    return legacySuccess(
      this.normalizeBigInts(
        this.toAdminPostReadModel(row, details, reviewsCount),
      ),
    );
  }

  async getPostReviews(id: string, userId: string) {
    if (!/^\d+$/.test(id)) {
      return legacyError('Invalid post ID format', 400);
    }

    const ownerRows = await this.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
      'SELECT id FROM post WHERE id = ? AND vendor_id = ? AND deleted = 0 LIMIT 1',
      id,
      userId,
    );
    if (ownerRows.length === 0) {
      return legacySuccess([]);
    }

    const reviews = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        reviewType: string;
        reasonKey: string | null;
        message: string | null;
        createdAt: Date;
      }>
    >(
      `SELECT
          id,
          review_type AS reviewType,
          reason_key AS reasonKey,
          message,
          dateCreated AS createdAt
       FROM post_review
       WHERE post_id = ? AND vendor_id = ?
       ORDER BY dateCreated DESC
       LIMIT 200`,
      id,
      userId,
    );

    return legacySuccess(this.normalizeBigInts(reviews));
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
        siteConfig: true,
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
        siteConfig: this.parseVendorSiteConfig(vendor.siteConfig),
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

  updateVendorSiteConfig(id: string, vendor: unknown) {
    return this.localUserVendorService.updateVendorSiteConfig(id, vendor);
  }

  deletePost(id: string, userId: string) {
    return this.localPostOrderService.markAsDeleted(id, userId);
  }

  markPostSold(id: string, userId: string) {
    return this.localPostOrderService.markAsSold(id, userId);
  }

  private toAdminPostReadModel(
    row: any,
    details = this.resolveCarDetails(row),
    reviewsCount = 0,
  ) {

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
      reviewsCount: reviewsCount,
    };
  }

  private resolveCarDetails(row: any) {
    return (
      row.car_detail_post_car_detail_idTocar_detail ??
      row.car_detail_car_detail_post_idTopost?.find(
        (item: any) => item.id === row.car_detail_id,
      ) ??
      row.car_detail_car_detail_post_idTopost?.find(
        (item: any) => item.post_id === row.id,
      ) ??
      row.car_detail_car_detail_post_idTopost?.[0] ??
      null
    );
  }

  private isDeletedPostGraph(row: any, details: any) {
    return Boolean(row?.deleted) || Boolean(details?.deleted);
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

  private async getReviewCountByPostIds(postIds: string[]): Promise<Map<string, number>> {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return new Map<string, number>();
    }

    const placeholders = postIds.map(() => '?').join(',');
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ postId: bigint; total: bigint | number }>
    >(
      `SELECT post_id as postId, COUNT(*) as total
       FROM post_review
       WHERE post_id IN (${placeholders})
       GROUP BY post_id`,
      ...postIds,
    );

    return new Map(
      rows.map((row) => [String(row.postId), Number(row.total ?? 0)]),
    );
  }

  private async getReviewCountByPostId(postId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint | number }>
    >(
      'SELECT COUNT(*) as total FROM post_review WHERE post_id = ?',
      postId,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private parseVendorSiteConfig(siteConfig: string | null | undefined) {
    if (!siteConfig || typeof siteConfig !== 'string') {
      return null;
    }
    try {
      const parsed = JSON.parse(siteConfig) as unknown;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}
