import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { JwtService } from '@nestjs/jwt';
import { mkdir, readFile } from 'fs/promises';
import { isAbsolute, join, relative, resolve } from 'path';
import sharp from 'sharp';
import { getMediaRootPath } from '../../common/media-path.util';
import { requireEnv } from '../../common/require-env.util';
import { getUserRoleNames } from '../../common/user-roles.util';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

type AnyRecord = Record<string, unknown>;

const jwtSecret = requireEnv('JWT_SECRET');
const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15MB hard limit for incoming media
const DEFAULT_ALLOWED_MEDIA_HOSTS = [
  'cdninstagram.com',
  'scontent.cdninstagram.com',
  '*.fbcdn.net',
];
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
]);

@Injectable()
export class LocalPostOrderService {
  private readonly jwtService: JwtService;
  private readonly mediaRoot = getMediaRootPath();
  private readonly mediaTmpRoot = resolve(this.mediaRoot, 'tmp');
  private readonly allowedMediaHosts = this.parseAllowedHosts(
    process.env.MEDIA_FETCH_ALLOWED_HOSTS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly localUserVendorService: LocalUserVendorService,
  ) {
    this.jwtService = new JwtService({
      secret: jwtSecret,
    });
  }

  async createPost(
    raw: unknown,
    emailFromJwt?: string,
  ): Promise<LegacyResponse> {
    return this.savePostInternal(raw, false, emailFromJwt);
  }

  async updatePost(
    raw: unknown,
    emailFromJwt?: string,
  ): Promise<LegacyResponse> {
    return this.savePostInternal(raw, true, emailFromJwt);
  }

  async createUserAndPost(
    raw: unknown,
    emailFromJwt?: string,
  ): Promise<LegacyResponse> {
    try {
      const input = (raw ?? {}) as AnyRecord;
      const post = ((input.post ?? {}) as AnyRecord) || {};
      const email =
        this.toSafeString(emailFromJwt) || this.toSafeString(post.email);
      if (!email) {
        return legacyError('User email is required.', 400);
      }

      let user = await this.findVendorAuthByEmail(email);
      let jwt = '';

      if (!user) {
        const randomPassword = this.generateRandomCode(8, false);
        const usernameFromEmail = email.split('@')[0] || email;
        const createResult = await this.localUserVendorService.createUser({
          user: {
            name: this.toSafeString(post.name) || usernameFromEmail,
            username: this.toSafeString(post.username) || usernameFromEmail,
            email,
            password: randomPassword,
            rewritePassword: randomPassword,
            phone: this.toSafeString(post.phone),
            whatsapp: this.toSafeString(post.whatsapp),
            location: this.toSafeString(post.location),
          },
        });

        if (!createResult.success) {
          return legacyError('Could not create user', 500);
        }

        user = await this.findVendorAuthByEmail(email);
        if (!user) {
          return legacyError('Could not create user', 500);
        }

        jwt = await this.jwtService.signAsync({
          iat: Math.floor(Date.now() / 1000),
          iss: 'your.domain.name',
          nbf: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
          userId: String(user.id),
          roles: await getUserRoleNames(this.prisma, String(user.id)),
          name: user.name ?? '',
          email: user.email ?? '',
          username: user.username ?? '',
        });
      }

      const postPayload = {
        vendorId: String(user.id),
        post,
      };
      const saved = await this.savePostInternal(postPayload, false);
      if (!saved.success) {
        return saved;
      }

      return legacySuccess(
        {
          jwt,
          postId: (saved.result as AnyRecord)?.postId ?? null,
        },
        'User and post created successfully',
      );
    } catch {
      return legacyError('Could not create user and post', 500);
    }
  }

  async markAsDeleted(postId: string, userId: string): Promise<LegacyResponse> {
    try {
      const post = await this.prisma.post.findFirst({
        where: {
          id: BigInt(postId),
          vendor_id: BigInt(userId),
          deleted: false,
        },
        select: { id: true },
      });
      if (!post) {
        return legacyError('Error while deleting post. Please try again', 500);
      }

      await this.prisma.post.update({
        where: { id: BigInt(postId) },
        data: { deleted: true, dateUpdated: new Date() },
      });
      await this.prisma.car_detail.updateMany({
        where: {
          OR: [{ post_id: BigInt(postId) }, { id: BigInt(postId) }],
        },
        data: { deleted: true, dateUpdated: new Date() },
      });
      await this.prisma.search.updateMany({
        where: { id: BigInt(postId) },
        data: { deleted: '1', dateUpdated: new Date() },
      });

      return legacySuccess(null, 'Post deleted successfully');
    } catch {
      return legacyError('Error while deleting post. Please try again', 500);
    }
  }

  async markAsSold(postId: string, userId: string): Promise<LegacyResponse> {
    try {
      const post = await this.prisma.post.findFirst({
        where: {
          id: BigInt(postId),
          vendor_id: BigInt(userId),
          deleted: false,
        },
        select: { id: true },
      });
      if (!post) {
        return legacyError(
          'Error while marking post as sold. Please try again',
          500,
        );
      }

      await this.prisma.car_detail.updateMany({
        where: { post_id: BigInt(postId) },
        data: { sold: true, dateUpdated: new Date() },
      });

      return legacySuccess(null, 'Post marked as sold successfully');
    } catch {
      return legacyError(
        'Error while marking post as sold. Please try again',
        500,
      );
    }
  }

  async createOrder(raw: unknown): Promise<unknown> {
    try {
      const payload = (raw ?? {}) as AnyRecord;
      const postId = this.toSafeString(payload.post_id);
      const cart = Array.isArray(payload.cart) ? payload.cart : [];
      const ownerEmail = this.toSafeString(payload.email);
      const phoneNumber = this.toSafeString(payload.phoneNumber);
      const fullName = this.toSafeString(payload.fullName);
      if (!postId || cart.length === 0) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const packageIds = cart
        .map((item) => this.toSafeString((item as AnyRecord).id))
        .filter(Boolean)
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id));

      if (packageIds.length === 0) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const packages = await this.prisma.promotion_packages.findMany({
        where: { id: { in: packageIds }, deleted: false },
      });
      if (packages.length === 0) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const post = await this.prisma.post.findUnique({
        where: { id: BigInt(postId) },
        select: { id: true, vendor_id: true, deleted: true },
      });
      if (!post || post.deleted) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      if (ownerEmail) {
        const owner = await this.findVendorAuthByEmail(ownerEmail);
        if (!owner || owner.id !== post.vendor_id) {
          return legacyError('ERROR: Something went wrong', 500);
        }
      }

      const orderId = BigInt(this.generateRandomCode(8, true));
      const paypalId = `LOCAL-${orderId.toString()}`;
      await this.prisma.customer_orders.create({
        data: {
          id: orderId,
          dateCreated: new Date(),
          deleted: false,
          paypalId,
          postId,
          packages: packages.map((p) => p.id).join(', '),
          email: ownerEmail || null,
          phoneNumber: phoneNumber || null,
          fullName: fullName || null,
          status: 'CREATED',
        },
      });

      return {
        id: paypalId,
        status: 'CREATED',
        links: [
          {
            rel: 'approve',
            href: `https://autoconnect.al/payments/mock/${paypalId}`,
            method: 'GET',
          },
        ],
      };
    } catch {
      return legacyError('ERROR: Something went wrong', 500);
    }
  }

  async captureOrder(orderID: string): Promise<unknown> {
    try {
      const order = await this.prisma.customer_orders.findFirst({
        where: { paypalId: orderID },
      });
      if (!order) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const postId = this.toSafeString(order.postId);
      if (!postId) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const post = await this.prisma.post.findUnique({
        where: { id: BigInt(postId) },
      });
      if (!post) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const normalizedStatus = this.toSafeString(order.status).toUpperCase();
      if (normalizedStatus === 'COMPLETED') {
        return {
          id: orderID,
          status: 'COMPLETED',
        };
      }
      if (normalizedStatus && normalizedStatus !== 'CREATED') {
        return legacyError('ERROR: Something went wrong', 409);
      }

      const ownerEmail = this.toSafeString(order.email);
      if (ownerEmail) {
        const owner = await this.findVendorAuthByEmail(ownerEmail);
        if (!owner || owner.id !== post.vendor_id) {
          return legacyError('ERROR: Something went wrong', 403);
        }
      }

      const packageIds = (order.packages ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const timePlus14Days = Math.floor(Date.now() / 1000) + 14 * 24 * 3600;
      const postUpdates: Record<string, unknown> = {};

      for (const packageId of packageIds) {
        switch (packageId) {
          case '111':
            postUpdates.renewTo = timePlus14Days;
            break;
          case '1112':
            postUpdates.highlightedTo = timePlus14Days;
            break;
          case '1113':
            postUpdates.promotionTo = timePlus14Days;
            break;
          case '1114':
            postUpdates.mostWantedTo = timePlus14Days;
            break;
          case '2111':
            postUpdates.renewTo = timePlus14Days;
            postUpdates.promotionTo = timePlus14Days;
            break;
          default:
            break;
        }
      }

      const captureState = await this.prisma.$transaction(async (tx) => {
        const transition = await tx.customer_orders.updateMany({
          where: { id: order.id, status: 'CREATED' },
          data: {
            status: 'COMPLETED',
            dateUpdated: new Date(),
          },
        });

        if (transition.count === 0) {
          const latest = await tx.customer_orders.findUnique({
            where: { id: order.id },
            select: { status: true },
          });
          if (this.toSafeString(latest?.status).toUpperCase() === 'COMPLETED') {
            return 'already-completed' as const;
          }
          throw new Error('Order transition failed');
        }

        if (Object.keys(postUpdates).length > 0) {
          await tx.post.update({
            where: { id: post.id },
            data: postUpdates,
          });

          await tx.search.updateMany({
            where: { id: post.id },
            data: {
              promotionTo:
                (postUpdates.promotionTo as number | undefined) ?? undefined,
              highlightedTo:
                (postUpdates.highlightedTo as number | undefined) ?? undefined,
              renewTo: (postUpdates.renewTo as number | undefined) ?? undefined,
              mostWantedTo:
                (postUpdates.mostWantedTo as number | undefined) ?? undefined,
              renewedTime: postUpdates.renewTo
                ? Math.floor(Date.now() / 1000)
                : undefined,
            },
          });
        }

        return 'captured' as const;
      });

      if (captureState === 'already-completed') {
        return {
          id: orderID,
          status: 'COMPLETED',
        };
      }

      return {
        id: orderID,
        status: 'COMPLETED',
      };
    } catch {
      return legacyError('ERROR: Something went wrong', 500);
    }
  }

  private async savePostInternal(
    raw: unknown,
    isUpdate: boolean,
    emailFromJwt?: string,
  ): Promise<LegacyResponse> {
    try {
      const payload = (raw ?? {}) as AnyRecord;
      const postInput = ((payload.post ?? {}) as AnyRecord) || {};
      if (Object.keys(postInput).length === 0) {
        return legacyError('Post data are required.', 400);
      }

      const jwtEmail = this.toSafeString(emailFromJwt);
      let vendorIdFromJwt: bigint | null = null;
      if (jwtEmail) {
        const jwtUser = await this.findVendorAuthByEmail(jwtEmail);
        if (!jwtUser) {
          return legacyError('User email is required.', 400);
        }
        vendorIdFromJwt = jwtUser.id;
      }

      const vendorIdRaw =
        this.toSafeString(payload.vendorId) ||
        this.toSafeString(postInput.vendorId);
      let vendorIdFromPayload: bigint | null = null;
      if (vendorIdRaw) {
        if (!/^\d+$/.test(vendorIdRaw)) {
          return legacyError('Invalid vendor id.', 400);
        }
        vendorIdFromPayload = BigInt(vendorIdRaw);
      }

      if (!vendorIdFromJwt && !vendorIdFromPayload) {
        return legacyError('Vendor id is required.', 400);
      }

      if (
        vendorIdFromJwt &&
        vendorIdFromPayload &&
        vendorIdFromJwt !== vendorIdFromPayload
      ) {
        return legacyError('Vendor id mismatch for authenticated user.', 403);
      }

      const vendorId = vendorIdFromJwt ?? vendorIdFromPayload;
      if (!vendorId) {
        return legacyError('Vendor id is required.', 400);
      }

      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });
      if (!vendor) {
        return legacyError(
          `Vendor with id: ${vendorId.toString()} does not exist`,
          500,
        );
      }

      const now = new Date();
      const postId =
        this.toSafeString(postInput.id) || this.generateRandomCode(18, true);
      const postIdBigInt = BigInt(postId);
      const captionText = this.toSafeString(postInput.caption);
      const cleanedCaption = this.cleanCaption(captionText);
      const sidecarInput = Array.isArray(postInput.sidecarMedias)
        ? postInput.sidecarMedias
        : [];
      const sidecar = await this.prepareSidecarMedias(
        sidecarInput,
        vendorId,
        postId,
      );
      const createdTime =
        this.toSafeString(postInput.createdTime) ||
        String(Math.floor(Date.now() / 1000));
      const likesCount = Number(postInput.likesCount ?? 0);
      const origin = this.toSafeString(postInput.origin) || 'MANUAL';
      const status = this.toSafeString(postInput.status) || 'DRAFT';

      const existing = await this.prisma.post.findUnique({
        where: { id: postIdBigInt },
      });
      if (isUpdate && !existing) {
        return legacyError('Post data are required.', 400);
      }

      const detailsSource =
        ((postInput.cardDetails ?? postInput.details ?? {}) as AnyRecord) || {};
      if (Object.keys(detailsSource).length === 0) {
        return legacyError('Error while saving post. Please try again', 500);
      }
      const sold = this.booleanFrom(detailsSource.sold, false);
      if (existing && existing.vendor_id !== vendorId) {
        return legacyError('Error while saving post. Please try again', 500);
      }

      const encodedCaption = Buffer.from(captionText, 'utf8').toString('base64');
      const normalizedLikes = Number.isFinite(likesCount)
        ? Math.max(0, likesCount)
        : 0;
      const normalizedEngineSize =
        this.toNullableString(detailsSource.engine) ??
        this.toNullableString(detailsSource.engineSize);
      const normalizedType = this.toNullableString(detailsSource.type) ?? 'car';
      const normalizedContact = JSON.stringify(this.extractContact(detailsSource));
      const normalizedCustomsPaid = this.nullableBooleanFrom(
        detailsSource.customsPaid,
      );

      await this.prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.post.update({
            where: { id: postIdBigInt },
            data: {
              caption: encodedCaption,
              cleanedCaption,
              sidecarMedias: JSON.stringify(sidecar),
              dateUpdated: now,
              likesCount: normalizedLikes,
              viewsCount: 0,
              origin,
              status,
            },
          });
        } else {
          await tx.post.create({
            data: {
              id: postIdBigInt,
              dateCreated: now,
              deleted: false,
              caption: encodedCaption,
              createdTime,
              sidecarMedias: JSON.stringify(sidecar),
              vendor_id: vendorId,
              live: false,
              likesCount: normalizedLikes,
              viewsCount: 0,
              cleanedCaption,
              revalidate: false,
              origin,
              status,
            },
          });
        }

        await tx.car_detail.upsert({
          where: { id: postIdBigInt },
          update: {
            dateUpdated: now,
            post_id: postIdBigInt,
            make: this.toNullableString(detailsSource.make),
            model: this.toNullableString(detailsSource.model),
            variant: this.toNullableString(detailsSource.variant),
            registration: this.toNullableString(detailsSource.registration),
            mileage: this.toNullableFloat(detailsSource.mileage),
            transmission: this.toNullableString(detailsSource.transmission),
            fuelType: this.toNullableString(detailsSource.fuelType),
            engineSize: normalizedEngineSize,
            drivetrain: this.toNullableString(detailsSource.drivetrain),
            seats: this.toNullableInt(detailsSource.seats),
            numberOfDoors: this.toNullableInt(detailsSource.numberOfDoors),
            bodyType: this.toNullableString(detailsSource.bodyType),
            sold,
            price: this.toNullableFloat(detailsSource.price) ?? 0,
            emissionGroup: this.toNullableString(detailsSource.emissionGroup),
            type: normalizedType,
            contact: normalizedContact,
            customsPaid: normalizedCustomsPaid,
            published: this.booleanFrom(detailsSource.published, false),
          },
          create: {
            id: postIdBigInt,
            dateCreated: now,
            post_id: postIdBigInt,
            make: this.toNullableString(detailsSource.make),
            model: this.toNullableString(detailsSource.model),
            variant: this.toNullableString(detailsSource.variant),
            registration: this.toNullableString(detailsSource.registration),
            mileage: this.toNullableFloat(detailsSource.mileage),
            transmission: this.toNullableString(detailsSource.transmission),
            fuelType: this.toNullableString(detailsSource.fuelType),
            engineSize: normalizedEngineSize,
            drivetrain: this.toNullableString(detailsSource.drivetrain),
            seats: this.toNullableInt(detailsSource.seats),
            numberOfDoors: this.toNullableInt(detailsSource.numberOfDoors),
            bodyType: this.toNullableString(detailsSource.bodyType),
            sold,
            price: this.toNullableFloat(detailsSource.price) ?? 0,
            emissionGroup: this.toNullableString(detailsSource.emissionGroup),
            type: normalizedType,
            contact: normalizedContact,
            customsPaid: normalizedCustomsPaid,
            published: this.booleanFrom(detailsSource.published, false),
          },
        });

        await tx.search.upsert({
          where: { id: postIdBigInt },
          update: {
            dateUpdated: now,
            deleted: sold ? '1' : '0',
            caption: encodedCaption,
            cleanedCaption,
            createdTime: BigInt(createdTime),
            sidecarMedias: JSON.stringify(sidecar),
            likesCount: normalizedLikes,
            viewsCount: 0,
            accountName: vendor.accountName,
            vendorId,
            profilePicture: vendor.profilePicture,
            make: this.toNullableString(detailsSource.make),
            model: this.toNullableString(detailsSource.model),
            variant: this.toNullableString(detailsSource.variant),
            registration: this.toNullableString(detailsSource.registration),
            mileage: this.toNullableInt(detailsSource.mileage),
            price: this.toNullableInt(detailsSource.price),
            transmission: this.toNullableString(detailsSource.transmission),
            fuelType: this.toNullableString(detailsSource.fuelType),
            engineSize: normalizedEngineSize,
            drivetrain: this.toNullableString(detailsSource.drivetrain),
            seats: this.toNullableInt(detailsSource.seats),
            numberOfDoors: this.toNullableInt(detailsSource.numberOfDoors),
            bodyType: this.toNullableString(detailsSource.bodyType),
            emissionGroup: this.toNullableString(detailsSource.emissionGroup),
            contact: normalizedContact,
            customsPaid: normalizedCustomsPaid,
            sold,
            type: normalizedType,
          },
          create: {
            id: postIdBigInt,
            dateCreated: now,
            deleted: sold ? '1' : '0',
            caption: encodedCaption,
            cleanedCaption,
            createdTime: BigInt(createdTime),
            sidecarMedias: JSON.stringify(sidecar),
            likesCount: normalizedLikes,
            viewsCount: 0,
            accountName: vendor.accountName,
            vendorId,
            profilePicture: vendor.profilePicture,
            make: this.toNullableString(detailsSource.make),
            model: this.toNullableString(detailsSource.model),
            variant: this.toNullableString(detailsSource.variant),
            registration: this.toNullableString(detailsSource.registration),
            mileage: this.toNullableInt(detailsSource.mileage),
            price: this.toNullableInt(detailsSource.price),
            transmission: this.toNullableString(detailsSource.transmission),
            fuelType: this.toNullableString(detailsSource.fuelType),
            engineSize: normalizedEngineSize,
            drivetrain: this.toNullableString(detailsSource.drivetrain),
            seats: this.toNullableInt(detailsSource.seats),
            numberOfDoors: this.toNullableInt(detailsSource.numberOfDoors),
            bodyType: this.toNullableString(detailsSource.bodyType),
            emissionGroup: this.toNullableString(detailsSource.emissionGroup),
            contact: normalizedContact,
            customsPaid: normalizedCustomsPaid,
            sold,
            type: normalizedType,
          },
        });
      });

      return legacySuccess({ postId }, 'Post saved successfully');
    } catch {
      return legacyError('Error while saving post. Please try again', 500);
    }
  }

  private extractContact(details: AnyRecord): AnyRecord {
    const contact = details.contact;
    if (!contact || typeof contact !== 'object') {
      return {
        phone_number: '',
        whatsapp: '',
        address: '',
      };
    }

    const c = contact as AnyRecord;
    return {
      phone_number: this.toSafeString(c.phone_number),
      whatsapp: this.toSafeString(c.whatsapp),
      address: this.toSafeString(c.address),
      location: this.toSafeString(c.location),
      email: this.toSafeString(c.email),
    };
  }

  private cleanCaption(value: string): string {
    if (!value) return '';
    return value
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableString(value: unknown): string | null {
    const v = this.toSafeString(value);
    return v.length > 0 ? v : null;
  }

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  private toNullableFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private booleanFrom(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (['true', '1', 'yes'].includes(v)) return true;
      if (['false', '0', 'no'].includes(v)) return false;
    }
    return fallback;
  }

  private nullableBooleanFrom(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (['true', '1', 'yes'].includes(v)) return true;
      if (['false', '0', 'no'].includes(v)) return false;
    }
    return null;
  }

  private generateRandomCode(length: number, onlyNumbers = false): string {
    const chars = onlyNumbers
      ? '0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async prepareSidecarMedias(
    sidecarInput: unknown[],
    vendorId: bigint,
    postId: string,
  ): Promise<
    Array<{ imageStandardResolutionUrl: string; imageThumbnailUrl: string }>
  > {
    if (sidecarInput.length === 0) return [];

    const vendorFolder = resolve(this.mediaRoot, vendorId.toString(), postId);
    await mkdir(vendorFolder, { recursive: true });

    const results: Array<{
      imageStandardResolutionUrl: string;
      imageThumbnailUrl: string;
    }> = [];

    for (const item of sidecarInput) {
      const media = (item ?? {}) as AnyRecord;
      const sourceUrl = this.toSafeString(media.imageStandardResolutionUrl);
      const type = this.toSafeString(media.type) || 'image';
      if (!sourceUrl || type !== 'image') continue;

      const mediaId =
        this.toSafeString(media.id) || this.generateRandomCode(18, true);
      const standardRelativePath = join(
        'media',
        vendorId.toString(),
        postId,
        `${mediaId}_standard.webp`,
      );
      const thumbnailRelativePath = join(
        'media',
        vendorId.toString(),
        postId,
        `${mediaId}_thumbnail.webp`,
      );
      const standardPath = resolve(
        this.mediaRoot,
        vendorId.toString(),
        postId,
        `${mediaId}_standard.webp`,
      );
      const thumbnailPath = resolve(
        this.mediaRoot,
        vendorId.toString(),
        postId,
        `${mediaId}_thumbnail.webp`,
      );

      const sourceBuffer = await this.readMediaBuffer(sourceUrl);
      if (!sourceBuffer) continue;

      await sharp(sourceBuffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(standardPath);
      await sharp(sourceBuffer)
        .resize({ width: 500, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(thumbnailPath);

      results.push({
        imageStandardResolutionUrl: standardRelativePath.replace(/\\/g, '/'),
        imageThumbnailUrl: thumbnailRelativePath.replace(/\\/g, '/'),
      });
    }

    return results;
  }

  private async readMediaBuffer(sourceUrl: string): Promise<Buffer | null> {
    if (!sourceUrl) return null;

    if (sourceUrl.startsWith('data:')) {
      const commaIndex = sourceUrl.indexOf(',');
      if (commaIndex < 0) return null;
      const header = sourceUrl.slice(0, commaIndex);
      const mimeMatch = header.match(/^data:([^;,]+)/i);
      const mime = (mimeMatch?.[1] ?? '').toLowerCase();
      if (!this.isAllowedImageMimeType(mime)) {
        return null;
      }
      const payload = sourceUrl.slice(commaIndex + 1);
      const isBase64 = header.includes(';base64');
      try {
        const buffer = Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
        if (!this.isWithinMediaSizeLimit(buffer)) {
          return null;
        }
        return (await this.isLikelyImageBuffer(buffer)) ? buffer : null;
      } catch {
        return null;
      }
    }

    if (/^https?:\/\//i.test(sourceUrl)) {
      try {
        const parsed = new URL(sourceUrl);
        if (parsed.protocol !== 'https:') {
          return null;
        }

        if (!this.isAllowedRemoteHost(parsed.hostname)) {
          return null;
        }

        const addresses = await lookup(parsed.hostname, {
          all: true,
          verbatim: true,
        });
        if (addresses.some((address) => this.isPrivateOrLocalAddress(address.address))) {
          return null;
        }

        const response = await fetch(sourceUrl);
        if (!response.ok) return null;
        const contentType = (
          response.headers.get('content-type') ?? ''
        ).split(';')[0].trim().toLowerCase();
        if (!this.isAllowedImageMimeType(contentType)) {
          return null;
        }
        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
          return null;
        }
        const bytes = await response.arrayBuffer();
        const buffer = Buffer.from(bytes);
        if (!this.isWithinMediaSizeLimit(buffer)) {
          return null;
        }
        return (await this.isLikelyImageBuffer(buffer)) ? buffer : null;
      } catch {
        return null;
      }
    }

    const sourcePath = this.resolveAllowedLocalMediaPath(sourceUrl);
    if (!sourcePath) {
      return null;
    }

    try {
      const buffer = await readFile(sourcePath);
      if (!this.isWithinMediaSizeLimit(buffer)) {
        return null;
      }
      return (await this.isLikelyImageBuffer(buffer)) ? buffer : null;
    } catch {
      return null;
    }
  }

  private async findVendorAuthByEmail(
    email: string,
  ): Promise<{ id: bigint; name: string | null; email: string | null; username: string | null } | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: bigint; name: string | null; email: string | null; username: string | null }>
    >(
      `
      SELECT id, name, email, username
      FROM vendor
      WHERE email = ? AND deleted = 0
      LIMIT 1
      `,
      email,
    );
    return rows[0] ?? null;
  }

  private parseAllowedHosts(raw: string | undefined): string[] {
    const parsed = (raw ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
    if (parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_ALLOWED_MEDIA_HOSTS;
  }

  private isAllowedRemoteHost(hostname: string): boolean {
    const host = hostname.trim().toLowerCase();
    if (!host) return false;

    return this.allowedMediaHosts.some((pattern) => {
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1); // includes dot
        return host.endsWith(suffix);
      }
      return host === pattern;
    });
  }

  private isPrivateOrLocalAddress(address: string): boolean {
    const normalized = address.trim().toLowerCase();
    if (!normalized) return true;

    if (normalized.startsWith('::ffff:')) {
      return this.isPrivateOrLocalAddress(normalized.slice(7));
    }

    const version = isIP(normalized);
    if (version === 4) {
      const parts = normalized.split('.').map((part) => Number(part));
      if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
        return true;
      }
      const [a, b] = parts;
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a === 198 && (b === 18 || b === 19)) return true;
      return false;
    }

    if (version === 6) {
      if (normalized === '::1') return true;
      if (normalized.startsWith('fe80:')) return true; // link-local
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique-local
      return false;
    }

    return true;
  }

  private resolveAllowedLocalMediaPath(sourceUrl: string): string | null {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('/media/tmp/')) {
      return this.safeResolveInsideRoot(
        this.mediaTmpRoot,
        trimmed.slice('/media/tmp/'.length),
      );
    }

    if (trimmed.startsWith('media/tmp/')) {
      return this.safeResolveInsideRoot(
        this.mediaTmpRoot,
        trimmed.slice('media/tmp/'.length),
      );
    }

    if (trimmed.startsWith('/media/')) {
      return this.safeResolveInsideRoot(
        this.mediaRoot,
        trimmed.slice('/media/'.length),
      );
    }

    if (trimmed.startsWith('media/')) {
      return this.safeResolveInsideRoot(
        this.mediaRoot,
        trimmed.slice('media/'.length),
      );
    }

    if (isAbsolute(trimmed)) {
      return this.isPathInsideRoot(trimmed, this.mediaRoot) ? trimmed : null;
    }

    // Relative arbitrary paths are not allowed.
    return null;
  }

  private safeResolveInsideRoot(root: string, childPath: string): string | null {
    const resolved = resolve(root, childPath);
    return this.isPathInsideRoot(resolved, root) ? resolved : null;
  }

  private isPathInsideRoot(targetPath: string, root: string): boolean {
    const rel = relative(root, targetPath);
    return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
  }

  private isAllowedImageMimeType(mimeType: string): boolean {
    return ALLOWED_MEDIA_MIME_TYPES.has(mimeType.toLowerCase());
  }

  private isWithinMediaSizeLimit(buffer: Buffer): boolean {
    return buffer.length > 0 && buffer.length <= MAX_MEDIA_BYTES;
  }

  private async isLikelyImageBuffer(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return Boolean(metadata.format);
    } catch {
      return false;
    }
  }
}
