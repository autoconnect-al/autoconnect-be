import { PrismaService } from '../../../src/database/prisma.service';

export const FIXTURE_VENDOR_ID = 1001n;
export const FIXTURE_POST_ID = 2001n;
export const FIXTURE_PROMOTION_PACKAGE_ID = 1113;

export async function seedVendor(
  prisma: PrismaService,
  vendorId = FIXTURE_VENDOR_ID,
): Promise<void> {
  const now = new Date();
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
        blocked,
        attemptedLogin,
        verified,
        useDetailsForPosts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    vendorId,
    now,
    now,
    false,
    `vendor-${vendorId.toString()}`,
    true,
    true,
    `Vendor ${vendorId.toString()}`,
    `vendor_${vendorId.toString()}`,
    `vendor_${vendorId.toString()}@example.com`,
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
