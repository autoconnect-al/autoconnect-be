import { PrismaService } from '../../../src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';

const jwt = new JwtService({
  secret: process.env.JWT_SECRET || 'integration-test-secret',
});

export const FIXTURE_VENDOR_ID = 1001n;
export const FIXTURE_POST_ID = 2001n;
export const FIXTURE_PROMOTION_PACKAGE_ID = 1113;

export async function seedVendor(
  prisma: PrismaService,
  vendorId = FIXTURE_VENDOR_ID,
  options?: {
    username?: string;
    email?: string;
    password?: string | null;
    accountName?: string;
  },
): Promise<void> {
  const now = new Date();
  const username = options?.username ?? `vendor_${vendorId.toString()}`;
  const email = options?.email ?? `vendor_${vendorId.toString()}@example.com`;
  const accountName = options?.accountName ?? `vendor-${vendorId.toString()}`;
  const password = options?.password ?? null;
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO vendor (
        id,
        dateCreated,
        dateUpdated,
        deleted,
        accountName,
        accountExists,
        initialised,
        name,
        username,
        email,
        password,
        blocked,
        attemptedLogin,
        verified,
        useDetailsForPosts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    vendorId,
    now,
    now,
    false,
    accountName,
    true,
    true,
    `Vendor ${vendorId.toString()}`,
    username,
    email,
    password,
    false,
    0,
    true,
    false,
  );
}

export async function seedPostGraph(
  prisma: PrismaService,
  options?: {
    postId?: bigint;
    vendorId?: bigint;
    promotionTo?: number | null;
    highlightedTo?: number | null;
    renewTo?: number | null;
    mostWantedTo?: number | null;
    renewInterval?: string | null;
    renewedTime?: number | null;
  },
): Promise<void> {
  const now = new Date();
  const postId = options?.postId ?? FIXTURE_POST_ID;
  const vendorId = options?.vendorId ?? FIXTURE_VENDOR_ID;

  await prisma.post.create({
    data: {
      id: postId,
      dateCreated: now,
      dateUpdated: now,
      deleted: false,
      caption: Buffer.from('Original caption', 'utf8').toString('base64'),
      createdTime: String(Math.floor(Date.now() / 1000)),
      sidecarMedias: '[]',
      vendor_id: vendorId,
      live: false,
      likesCount: 0,
      viewsCount: 0,
      cleanedCaption: 'Original caption',
      origin: 'MANUAL',
      status: 'DRAFT',
      promotionTo: options?.promotionTo ?? null,
      highlightedTo: options?.highlightedTo ?? null,
      renewTo: options?.renewTo ?? null,
      mostWantedTo: options?.mostWantedTo ?? null,
      renewInterval: options?.renewInterval ?? null,
      renewedTime: options?.renewedTime ?? null,
    },
  });

  await prisma.car_detail.create({
    data: {
      id: postId,
      dateCreated: now,
      dateUpdated: now,
      deleted: false,
      post_id: postId,
      make: 'BMW',
      model: 'X5',
      sold: false,
      price: 12000,
      type: 'car',
      contact: JSON.stringify({ phone_number: '', whatsapp: '', address: '' }),
      published: false,
    },
  });

  await prisma.search.create({
    data: {
      id: postId,
      dateCreated: now,
      dateUpdated: now,
      deleted: '0',
      caption: Buffer.from('Original caption', 'utf8').toString('base64'),
      cleanedCaption: 'Original caption',
      createdTime: BigInt(Math.floor(Date.now() / 1000)),
      sidecarMedias: '[]',
      likesCount: 0,
      viewsCount: 0,
      accountName: `vendor-${vendorId.toString()}`,
      vendorId,
      make: 'BMW',
      model: 'X5',
      sold: false,
      type: 'car',
      promotionTo: options?.promotionTo ?? null,
      highlightedTo: options?.highlightedTo ?? null,
      renewTo: options?.renewTo ?? null,
      mostWantedTo: options?.mostWantedTo ?? null,
      renewInterval: options?.renewInterval ?? null,
      renewedTime: options?.renewedTime ?? null,
    },
  });
}

export async function seedPromotionPackage(
  prisma: PrismaService,
  packageId = FIXTURE_PROMOTION_PACKAGE_ID,
): Promise<void> {
  const now = new Date();
  await prisma.promotion_packages.create({
    data: {
      id: packageId,
      dateCreated: now,
      dateUpdated: now,
      name: `pkg-${packageId}`,
      price: 9.99,
      deleted: false,
    },
  });
}

export async function seedRole(
  prisma: PrismaService,
  roleName: string,
  roleId: number,
): Promise<void> {
  const now = new Date();
  await prisma.role.create({
    data: {
      id: roleId,
      dateCreated: now,
      dateUpdated: now,
      deleted: false,
      name: roleName,
    },
  });
}

export async function seedCarMakeModel(
  prisma: PrismaService,
  params: {
    id: number;
    make: string;
    model: string;
    type?: string;
    isVariant?: boolean;
  },
): Promise<void> {
  await prisma.car_make_model.create({
    data: {
      id: params.id,
      Make: params.make,
      Model: params.model,
      type: params.type ?? 'car',
      isVariant: params.isVariant ?? false,
    },
  });
}

export async function seedVendorRole(
  prisma: PrismaService,
  vendorId: bigint,
  roleId: number,
): Promise<void> {
  await prisma.vendor_role.create({
    data: {
      vendor_id: vendorId,
      role_id: roleId,
    },
  });
}

export async function issueLegacyJwt(params: {
  userId: string;
  roles: string[];
  email?: string;
  username?: string;
  name?: string;
}): Promise<string> {
  return jwt.signAsync({
    iat: Math.floor(Date.now() / 1000),
    iss: 'your.domain.name',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    userId: params.userId,
    roles: params.roles,
    email: params.email ?? '',
    username: params.username ?? '',
    name: params.name ?? '',
  });
}

export function buildCreatePostPayload(params?: {
  postId?: string;
  vendorId?: string;
  caption?: string;
  price?: number;
  promotionTo?: number;
  highlightedTo?: number;
  renewTo?: number;
  mostWantedTo?: number;
  renewInterval?: string;
  renewedTime?: number;
}): Record<string, unknown> {
  const postId = params?.postId ?? FIXTURE_POST_ID.toString();
  const vendorId = params?.vendorId ?? FIXTURE_VENDOR_ID.toString();

  return {
    vendorId,
    post: {
      id: postId,
      caption: params?.caption ?? 'Hello integration test',
      createdTime: String(Math.floor(Date.now() / 1000)),
      cardDetails: {
        make: 'BMW',
        model: 'X5',
        type: 'car',
        transmission: 'automatic',
        fuelType: 'diesel',
        price: params?.price ?? 15500,
        sold: false,
        published: false,
      },
      promotionTo: params?.promotionTo,
      highlightedTo: params?.highlightedTo,
      renewTo: params?.renewTo,
      mostWantedTo: params?.mostWantedTo,
      renewInterval: params?.renewInterval,
      renewedTime: params?.renewedTime,
    },
  };
}

export function buildCreateOrderPayload(params?: {
  postId?: string;
  packageId?: number;
  email?: string;
}): Record<string, unknown> {
  return {
    post_id: params?.postId ?? FIXTURE_POST_ID.toString(),
    email: params?.email,
    cart: [
      {
        id: String(params?.packageId ?? FIXTURE_PROMOTION_PACKAGE_ID),
      },
    ],
  };
}
