import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createTestApp } from './helpers/create-test-app';
import {
  disconnectDatabase,
  getPrisma,
  resetDatabase,
  runMigrationsOnce,
  waitForDatabaseReady,
} from './helpers/db-lifecycle';
import {
  buildCreatePostPayload,
  issueLegacyJwt,
  seedCarMakeModel,
  seedPostGraph,
  seedRole,
  seedVendor,
  seedVendorRole,
} from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: legacy-ap admin/tooling surfaces', () => {
  let app: INestApplication;
  const prisma = getPrisma();

  const ADMIN_VENDOR_ID = 9301n;
  const TARGET_VENDOR_ID = 9302n;

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS article (
        id VARCHAR(100) NOT NULL,
        dateCreated DATETIME(0) NOT NULL,
        dateUpdated DATETIME(0) NULL,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        data LONGTEXT NULL,
        image VARCHAR(255) NULL,
        appName VARCHAR(255) NOT NULL DEFAULT 'autoconnect',
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await disconnectDatabase();
  });

  async function seedAdminIdentity(): Promise<string> {
    await seedVendor(prisma, ADMIN_VENDOR_ID, {
      username: 'ap_admin',
      email: 'ap-admin@example.com',
      password: await bcrypt.hash('Password123!', 12),
    });
    await seedRole(prisma, 'USER', 1);
    await seedRole(prisma, 'ADMIN', 99);
    await seedVendorRole(prisma, ADMIN_VENDOR_ID, 99);

    return issueLegacyJwt({
      userId: ADMIN_VENDOR_ID.toString(),
      roles: ['ADMIN'],
      email: 'ap-admin@example.com',
      username: 'ap_admin',
      name: 'AP Admin',
    });
  }

  it('admin-guarded AP endpoints reject unauthorized calls', async () => {
    await request(app.getHttpServer()).get('/make-model-data/makes').expect(401);
    await request(app.getHttpServer()).post('/role-management/create-role').expect(401);
  });

  it('make-model-data endpoints return car and motorcycle datasets for admin token', async () => {
    const adminToken = await seedAdminIdentity();
    await seedCarMakeModel(prisma, {
      id: 1,
      make: 'Audi',
      model: 'A4',
      type: 'car',
      isVariant: false,
    });
    await seedCarMakeModel(prisma, {
      id: 2,
      make: 'Yamaha',
      model: 'MT-07',
      type: 'motorcycle',
      isVariant: true,
    });

    const makes = await request(app.getHttpServer())
      .get('/make-model-data/makes')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(makes.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: ['Audi'],
    });

    const motorcycleModels = await request(app.getHttpServer())
      .get('/make-model-data/models/motorcycle/Yamaha')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(motorcycleModels.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [{ model: 'MT-07', isVariant: 1 }],
    });
  });

  it('role-management create/update/delete and grant/revoke admin flows work end-to-end', async () => {
    const adminToken = await seedAdminIdentity();
    await seedVendor(prisma, TARGET_VENDOR_ID, {
      username: 'target_vendor',
      email: 'target-vendor@example.com',
    });

    const createRole = await request(app.getHttpServer())
      .post('/role-management/create-role')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ role: { name: 'EDITOR' } })
      .expect(200);

    expect(createRole.body).toMatchObject({ success: true, statusCode: '200', result: true });

    const createdRole = await prisma.role.findFirst({ where: { name: 'EDITOR' } });
    expect(createdRole).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/role-management/update-role/${createdRole?.id ?? 0}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ role: { name: 'CONTENT_EDITOR' } })
      .expect(200);

    const updatedRole = await prisma.role.findUnique({ where: { id: createdRole?.id ?? 0 } });
    expect(updatedRole?.name).toBe('CONTENT_EDITOR');

    await request(app.getHttpServer())
      .post(`/role-management/grant-admin/${TARGET_VENDOR_ID.toString()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const granted = await prisma.vendor_role.findUnique({
      where: {
        vendor_id_role_id: {
          vendor_id: TARGET_VENDOR_ID,
          role_id: 99,
        },
      },
    });
    expect(granted).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/role-management/revoke-admin/${TARGET_VENDOR_ID.toString()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const revoked = await prisma.vendor_role.findUnique({
      where: {
        vendor_id_role_id: {
          vendor_id: TARGET_VENDOR_ID,
          role_id: 99,
        },
      },
    });
    expect(revoked).toBeNull();

    await request(app.getHttpServer())
      .delete(`/role-management/delete-role/${createdRole?.id ?? 0}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const deletedRole = await prisma.role.findUnique({ where: { id: createdRole?.id ?? 0 } });
    expect(deletedRole?.deleted).toBe(true);
  });

  it('user-management and vendor-management endpoints mutate expected vendor fields', async () => {
    const adminToken = await seedAdminIdentity();

    const unique = Date.now();
    await request(app.getHttpServer())
      .post('/user-management/create-user')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        user: {
          name: 'Managed User',
          username: `managed_user_${unique}`,
          email: `managed-user-${unique}@example.com`,
          password: 'Password123!',
          rewritePassword: 'Password123!',
          phone: '0680000000',
          whatsapp: '0680000000',
          location: 'Tirana',
        },
      })
      .expect(200);

    const managed = await prisma.vendor.findFirst({
      where: { email: `managed-user-${unique}@example.com` },
      select: { id: true, username: true, deleted: true },
    });
    expect(managed).toBeTruthy();

    const byUsername = await request(app.getHttpServer())
      .get(`/user-management/user/username/${managed?.username ?? ''}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(byUsername.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: String(managed?.id ?? ''),
        username: managed?.username,
      }),
    });

    await request(app.getHttpServer())
      .post('/vendor-management/add/9501')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/vendor-management/add/details/9501')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ account: JSON.stringify({ username: 'vendor-9501', profilePicUrl: 'https://img.example/9501.webp' }) })
      .expect(200);

    await request(app.getHttpServer())
      .post('/vendor-management/edit/9501')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        vendor: {
          accountName: 'vendor-9501-edited',
          biography: 'Vendor 9501 biography',
          contact: { phone_number: '0670000000' },
          profilePicture: 'https://img.example/9501-updated.webp',
        },
      })
      .expect(200);

    const managedVendor = await prisma.vendor.findUnique({
      where: { id: 9501n },
      select: {
        accountExists: true,
        accountName: true,
        biography: true,
        contact: true,
        profilePicture: true,
      },
    });

    expect(managedVendor).toMatchObject({
      accountExists: true,
      accountName: 'vendor-9501-edited',
      biography: 'Vendor 9501 biography',
      profilePicture: 'https://img.example/9501-updated.webp',
    });
    expect(managedVendor?.contact).toContain('0670000000');

    await request(app.getHttpServer())
      .delete(`/user-management/delete-user/${managed?.id?.toString() ?? '0'}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const deletedUser = await prisma.vendor.findUnique({ where: { id: BigInt(String(managed?.id ?? '0')) } });
    expect(deletedUser?.deleted).toBe(true);
  });

  it('article admin CRUD and AP code guarded post endpoint smoke work', async () => {
    const adminToken = await seedAdminIdentity();

    const createArticle = await request(app.getHttpServer())
      .post('/article/create')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        category: 'cars',
        appName: 'autoconnect',
        image: 'https://img.example/article.webp',
        data: [{ language: 'en', title: 'AP Article Title', body: 'Body' }],
      })
      .expect(200);

    expect(createArticle.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: expect.any(String),
        category: 'cars',
      }),
    });

    const articleId = createArticle.body.result.id as string;

    await request(app.getHttpServer())
      .post(`/article/update/${articleId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        category: 'news',
        appName: 'autoconnect',
        image: 'https://img.example/article-v2.webp',
        data: [{ language: 'en', title: 'AP Article Updated', body: 'Body 2' }],
      })
      .expect(200);

    const readArticle = await request(app.getHttpServer())
      .get(`/article/${articleId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(readArticle.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: articleId,
        category: 'news',
      }),
    });

    const all = await request(app.getHttpServer())
      .get('/article/all')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(all.body).toMatchObject({ success: true, statusCode: '200', result: expect.any(Array) });
    expect(all.body.result.some((row: { id?: string }) => row.id === articleId)).toBe(true);

    await request(app.getHttpServer()).get('/post/posts?ids=1').expect(401);

    await seedVendor(prisma, 9305n, { accountName: 'post-tooling-vendor' });
    await seedPostGraph(prisma, { postId: 9901n, vendorId: 9305n });
    await prisma.car_detail.update({
      where: { id: 9901n },
      data: {
        registration: '2026',
        price: 22000,
      },
    });
    await prisma.$executeRawUnsafe(
      `
      UPDATE search
      SET registration = ?, price = ?
      WHERE id = ?
      `,
      '1999',
      1,
      9901n,
    );

    const withCode = await request(app.getHttpServer())
      .get('/post/posts?ids=9901')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);

    expect(withCode.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [
        expect.objectContaining({
          id: '9901',
          registration: '2026',
          price: 22000,
        }),
      ],
    });

    await prisma.car_detail.update({
      where: { id: 9901n },
      data: { deleted: true },
    });
    await prisma.post.update({
      where: { id: 9901n },
      data: { deleted: false },
    });

    const deletedFromDetails = await request(app.getHttpServer())
      .get('/post/posts?ids=9901')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);

    expect(deletedFromDetails.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: [],
    });
  });

  it('vendor-management crawl and toggle endpoints update expected vendor/post states', async () => {
    const adminToken = await seedAdminIdentity();
    await seedVendor(prisma, 9601n, { accountName: 'crawl-a' });
    await seedVendor(prisma, 9602n, { accountName: 'crawl-b' });
    await seedPostGraph(prisma, { postId: 9961n, vendorId: 9601n });
    await prisma.vendor.update({
      where: { id: 9601n },
      data: { dateUpdated: new Date(Date.now() - 10_000) },
    });
    await prisma.vendor.update({
      where: { id: 9602n },
      data: { dateUpdated: new Date() },
    });

    const next = await request(app.getHttpServer())
      .get('/vendor-management/next-to-crawl')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(next.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({ id: '9601' }),
    });

    await request(app.getHttpServer())
      .get('/vendor-management/mark-vendor-for-crawl-next/9602')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const marked = await prisma.vendor.findUnique({ where: { id: 9602n } });
    expect(marked?.dateUpdated).toBeNull();

    await request(app.getHttpServer())
      .get('/vendor-management/toggle-deleted/9601')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const deletedVendor = await prisma.vendor.findUnique({ where: { id: 9601n } });
    const deletedPost = await prisma.post.findUnique({ where: { id: 9961n } });
    const deletedDetails = await prisma.car_detail.findUnique({ where: { id: 9961n } });
    expect(deletedVendor?.deleted).toBe(true);
    expect(deletedPost?.deleted).toBe(true);
    expect(deletedDetails?.deleted).toBe(true);

    await request(app.getHttpServer())
      .get('/vendor-management/toggle-deleted/9601')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const restoredVendor = await prisma.vendor.findUnique({ where: { id: 9601n } });
    expect(restoredVendor?.deleted).toBe(false);
  });

  it('AP post tooling operational endpoints work with AP code', async () => {
    await seedVendor(prisma, 9701n, { accountName: 'tooling-vendor' });
    await seedPostGraph(prisma, { postId: 9971n, vendorId: 9701n });
    await prisma.post.update({
      where: { id: 9971n },
      data: {
        dateUpdated: new Date(Date.now() - 181 * 24 * 3600 * 1000),
        likesCount: 25,
        renewInterval: '14d',
        renewTo: null,
      },
    });
    await prisma.car_detail.update({
      where: { id: 9971n },
      data: { type: '' },
    });

    await request(app.getHttpServer())
      .get('/post/scrape-posts')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);

    const createStatus = await request(app.getHttpServer())
      .get('/post/scrape-posts/create?vendorAccountName=tooling-vendor')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);

    const importStatusId = createStatus.body.result as string;
    const details = await request(app.getHttpServer())
      .get('/post/scrape-posts/details')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);
    expect(details.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({ vendor: 'tooling-vendor' }),
    });

    await request(app.getHttpServer())
      .post('/post/scrape-posts/update')
      .set('x-admin-code', 'integration-ap-admin-code')
      .send({ id: importStatusId, progress: '65%', status: 'RUNNING' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/post/scrape-posts/cleanPosts')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);
    const cleanedPost = await prisma.post.findUnique({ where: { id: 9971n } });
    expect(cleanedPost?.deleted).toBe(true);

    await prisma.post.update({
      where: { id: 9971n },
      data: { deleted: false, dateUpdated: new Date(), renewTo: null },
    });

    await request(app.getHttpServer())
      .get('/post/scrape-posts/fix-details')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);
    const fixedDetails = await prisma.car_detail.findUnique({ where: { id: 9971n } });
    expect(fixedDetails?.type).toBe('car');

    await request(app.getHttpServer())
      .get('/post/scrape-posts/update-search')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);

    const mostLiked = await request(app.getHttpServer())
      .get('/post/get-most-liked')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);
    expect(mostLiked.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });

    await request(app.getHttpServer())
      .get('/post/auto-renew')
      .set('x-admin-code', 'integration-ap-admin-code')
      .expect(200);
    const renewed = await prisma.post.findUnique({ where: { id: 9971n } });
    expect(renewed?.renewTo).toBeTruthy();
  });

  it('AP write routes cover save/update post, vendor admin update/delete, and user-management update/read by id', async () => {
    const adminToken = await seedAdminIdentity();
    await seedVendor(prisma, 9702n, { accountName: 'save-update-vendor' });

    const savePayload = buildCreatePostPayload({
      vendorId: '9702',
      postId: '9972',
      caption: 'AP save post',
      price: 18000,
    });
    const saveResponse = await request(app.getHttpServer())
      .post('/post/save-post')
      .set('x-admin-code', 'integration-ap-admin-code')
      .send(savePayload)
      .expect(200);
    expect(saveResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: { postId: '9972' },
    });

    const updatePayload = buildCreatePostPayload({
      vendorId: '9702',
      postId: '9972',
      caption: 'AP updated post',
      price: 22000,
    });
    await request(app.getHttpServer())
      .post('/post/update/9972')
      .set('x-admin-code', 'integration-ap-admin-code')
      .send(updatePayload)
      .expect(200);
    const updatedPost = await prisma.post.findUnique({ where: { id: 9972n } });
    const updatedSearch = await prisma.search.findUnique({ where: { id: 9972n } });
    expect(updatedPost?.cleanedCaption).toBe('AP updated post');
    expect(updatedSearch).toBeNull();

    await seedVendor(prisma, 9703n, { accountName: 'vendor-admin-target' });
    await request(app.getHttpServer())
      .post('/vendor/update')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        vendor: {
          id: '9703',
          biography: 'Vendor admin biography',
          contact: { phone_number: '0660000000' },
        },
      })
      .expect(200);
    const updatedVendor = await prisma.vendor.findUnique({ where: { id: 9703n } });
    expect(updatedVendor?.biography).toBe('Vendor admin biography');
    expect(updatedVendor?.contact).toContain('0660000000');

    await request(app.getHttpServer())
      .delete('/vendor/delete/9703')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const deletedVendor = await prisma.vendor.findUnique({ where: { id: 9703n } });
    expect(deletedVendor?.deleted).toBe(true);

    const unique = Date.now();
    await request(app.getHttpServer())
      .post('/user-management/create-user')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        user: {
          name: 'Update User Target',
          username: `update_user_${unique}`,
          email: `update-user-${unique}@example.com`,
          password: 'Password123!',
          rewritePassword: 'Password123!',
          phone: '0681111111',
          whatsapp: '0681111111',
          location: 'Tirane',
        },
      })
      .expect(200);
    const createdUser = await prisma.vendor.findFirst({
      where: { email: `update-user-${unique}@example.com` },
      select: { id: true },
    });
    expect(createdUser).toBeTruthy();

    const byId = await request(app.getHttpServer())
      .get(`/user-management/user/${createdUser?.id?.toString() ?? '0'}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(byId.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: createdUser?.id?.toString(),
      }),
    });

    await request(app.getHttpServer())
      .post(`/user-management/update-user/${createdUser?.id?.toString() ?? '0'}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        user: {
          email: `update-user-${unique}@example.com`,
          username: `update_user_${unique}_v2`,
          name: 'Update User Target V2',
          password: 'Password123!',
          rewritePassword: 'Password123!',
          phone: '0682222222',
          whatsapp: '0682222222',
          location: 'Durres',
        },
      })
      .expect(200);

    const updatedUser = await prisma.vendor.findUnique({
      where: { id: BigInt(String(createdUser?.id ?? '0')) },
      select: {
        username: true,
        name: true,
        phoneNumber: true,
        whatsAppNumber: true,
        location: true,
      },
    });
    expect(updatedUser).toMatchObject({
      username: `update_user_${unique}_v2`,
      name: 'Update User Target V2',
      phoneNumber: '0682222222',
      whatsAppNumber: '0682222222',
      location: 'Durres',
    });
  });

  it('AP prompt/import/cache, sitemap generate and payment reminders endpoints respond with legacy envelopes', async () => {
    const adminToken = await seedAdminIdentity();
    await seedVendor(prisma, 9801n, { accountName: 'manual-vendor' });
    await seedPostGraph(prisma, { postId: 9981n, vendorId: 9801n });
    await prisma.post.update({
      where: { id: 9981n },
      data: { origin: 'MANUAL', status: 'DRAFT' },
    });

    await request(app.getHttpServer())
      .get('/car-details/generate-prompt')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/car-details/generate-prompt-fix-variant')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/car-details/generate-prompt-fix-registration')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/car-details/generate-prompt-fix-mileage')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/car-details/generate-prompt-fix-price')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/car-details/generate-prompt-fix-motorcycle-details')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const manualDrafts = await request(app.getHttpServer())
      .get('/car-details/get-manual-draft-posts')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(manualDrafts.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Array),
    });
    expect(
      manualDrafts.body.result.some((row: { id?: string }) => row.id === '9981'),
    ).toBe(true);

    const runId = `prompt-int-${Date.now().toString()}`;
    const importResponse = await request(app.getHttpServer())
      .post('/car-details/import')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        runId,
        result: JSON.stringify([
          {
            id: '9981',
            make: 'Audi',
            model: 'A3',
            sold: false,
            type: 'car',
            status: 'DRAFT',
          },
        ]),
      })
      .expect(200);
    expect(importResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
    });

    const importStatus = await request(app.getHttpServer())
      .get(`/car-details/import-status/${runId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(importStatus.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        runId,
      }),
    });

    await request(app.getHttpServer())
      .get('/car-details/clean-cache')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(500);

    await request(app.getHttpServer())
      .get('/sitemap/generate')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const now = Date.now();
    const threeDayWindow = new Date(now - Math.floor(11.5 * 24 * 3600 * 1000));
    const oneDayWindow = new Date(now - Math.floor(14.5 * 24 * 3600 * 1000));
    await prisma.customer_orders.createMany({
      data: [
        {
          id: 80001n,
          dateCreated: threeDayWindow,
          dateUpdated: threeDayWindow,
          deleted: false,
          paypalId: 'REMIND-3D',
          postId: '9981',
          packages: '[1113]',
          email: 'three-day@example.com',
          status: 'COMPLETED',
        },
        {
          id: 80002n,
          dateCreated: oneDayWindow,
          dateUpdated: oneDayWindow,
          deleted: false,
          paypalId: 'REMIND-1D',
          postId: '9981',
          packages: '[1113]',
          email: 'one-day@example.com',
          status: 'COMPLETED',
        },
      ],
    });

    const remind = await request(app.getHttpServer())
      .get('/api/v1/orders/send-remind-emails')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(remind.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.any(Object),
    });
    expect(Number(remind.body.result.oneDayCandidates)).toBeGreaterThanOrEqual(1);
    expect(Number(remind.body.result.threeDayCandidates)).toBeGreaterThanOrEqual(1);
    expect(typeof remind.body.result.emailDeliveryEnabled).toBe('boolean');
    expect(remind.body.result.sent).toEqual(
      expect.objectContaining({
        oneDay: expect.any(Number),
        threeDay: expect.any(Number),
      }),
    );
  });
});
