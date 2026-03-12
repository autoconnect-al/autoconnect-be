import { ApVendorManagementService } from './ap-vendor-management.service';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ApVendorManagementService', () => {
  const createService = (prisma: any = {}) =>
    new ApVendorManagementService(prisma);

  it('toggles vendor + related posts/details to deleted', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n, deleted: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      post: {
        findMany: jest.fn().mockResolvedValue([{ id: 11n }, { id: 12n }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      car_detail: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.toggleVendorDeleted('1');

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.post.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendor_id: 1n },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
    expect(prisma.car_detail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { post_id: { in: [11n, 12n] } },
        data: expect.objectContaining({ deleted: true }),
      }),
    );
  });

  it('returns error when vendor does not exist', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.toggleVendorDeleted('999');

    expect(response.success).toBe(false);
    expect(response.message).toContain('Could not mark vendor for crawl next');
  });

  it('addVendor initializes placeholder identity defaults', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.addVendor('33');

    expect(response.success).toBe(true);
    expect(prisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountExists: false,
          initialised: false,
          isVendor: false,
          isNormalUser: true,
          isReposter: false,
        }),
      }),
    );
  });

  it('addVendorDetails sets vendor identity defaults', async () => {
    const prisma = {
      vendor: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.addVendorDetails('44', {
      account: JSON.stringify({
        username: 'vendor-44',
        profilePicUrl: 'https://img.example/vendor-44.webp',
      }),
    });

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 44n },
        data: expect.objectContaining({
          accountExists: true,
          isVendor: true,
          isNormalUser: false,
          isReposter: false,
        }),
      }),
    );
  });

  it('editVendor enforces identity exclusivity and reposter coercion', async () => {
    const prisma = {
      vendor: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.editVendor('55', {
      vendor: {
        isNormalUser: true,
        isReposter: true,
      },
    });

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55n },
        data: expect.objectContaining({
          isVendor: false,
          isNormalUser: true,
          isReposter: false,
        }),
      }),
    );
  });

  it('editVendor keeps reposter true for explicit vendor profiles', async () => {
    const prisma = {
      vendor: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService(prisma);
    const response = await service.editVendor('56', {
      vendor: {
        isVendor: true,
        isReposter: true,
      },
    });

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 56n },
        data: expect.objectContaining({
          isVendor: true,
          isNormalUser: false,
          isReposter: true,
        }),
      }),
    );
  });

  it('updates site settings on requested target with validation', async () => {
    const targetClient = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService({
      vendor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any);

    jest
      .spyOn(service as any, 'resolveTargetClient')
      .mockReturnValue({ ok: true, client: targetClient });

    const response = await service.updateVendorSiteSettings('1', 'dev', {
      siteSettings: {
        siteEnabled: true,
        subdomain: 'vendor-site',
        customDomain: 'vendor.example.com',
        theme: 'classic',
        primaryColor: '#123456',
      },
    });

    expect(response.success).toBe(true);
    expect(targetClient.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({
          siteEnabled: true,
          subdomain: 'vendor-site',
          customDomain: 'vendor.example.com',
          theme: 'classic',
          primaryColor: '#123456',
        }),
      }),
    );
  });

  it('publishes dev site settings to prod', async () => {
    const devClient = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5n,
          siteEnabled: true,
          subdomain: 'published-vendor',
          customDomain: 'published.example.com',
          theme: 'clean',
          primaryColor: '#112233',
          secondaryColor: '#445566',
          logo: 'logo.svg',
          banner: 'banner.webp',
          siteConfig: '{"version":1,"pages":{"home":{"sections":[]},"about":{"sections":[]},"contact":{"sections":[]}}}',
        }),
      },
    } as any;

    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 5n }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const service = createService(prisma);
    jest
      .spyOn(service as any, 'resolveTargetClient')
      .mockReturnValue({ ok: true, client: devClient });

    const response = await service.publishVendorSiteSettings('5');

    expect(response.success).toBe(true);
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5n },
        data: expect.objectContaining({
          siteEnabled: true,
          subdomain: 'published-vendor',
          customDomain: 'published.example.com',
          theme: 'clean',
        }),
      }),
    );
  });

  it('uploads vendor site media to vendor_site folder', async () => {
    const mediaRoot = await mkdtemp(join(tmpdir(), 'vendor-site-upload-'));
    const previousMediaRoot = process.env.MEDIA_ROOT;
    process.env.MEDIA_ROOT = mediaRoot;

    const targetClient = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n }),
      },
    } as any;

    const service = createService({
      vendor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any);

    jest
      .spyOn(service as any, 'resolveTargetClient')
      .mockReturnValue({ ok: true, client: targetClient });

    try {
      const response = await service.uploadVendorSiteMedia(
        '1',
        'dev',
        {
          buffer: Buffer.from([1, 2, 3, 4]),
          size: 4,
          mimetype: 'image/png',
          originalname: 'logo.png',
        } as Express.Multer.File,
        'logo',
      );

      expect(response.success).toBe(true);
      expect(response.result).toEqual(
        expect.objectContaining({
          path: expect.stringMatching(/^\/media\/vendor_site\/1\/\d+-[a-f0-9]{16}\.png$/),
          field: 'logo',
        }),
      );
    } finally {
      process.env.MEDIA_ROOT = previousMediaRoot;
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });
});
