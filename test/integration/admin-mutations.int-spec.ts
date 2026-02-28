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
  issueLegacyJwt,
  seedPostGraph,
  seedRole,
  seedVendor,
  seedVendorRole,
} from './fixtures/domain-fixtures';

jest.setTimeout(120_000);

describe('Integration: admin mutations', () => {
  let app: INestApplication;
  const prisma = getPrisma();

  const ADMIN_VENDOR_ID = 8001n;
  const NON_ADMIN_VENDOR_ID = 8002n;
  const ADMIN_POST_ID = 8101n;

  beforeAll(async () => {
    await waitForDatabaseReady();
    await runMigrationsOnce();
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

  async function seedAdminIdentity(): Promise<void> {
    await seedVendor(prisma, ADMIN_VENDOR_ID, {
      username: 'admin_actor',
      email: 'admin-actor@example.com',
      password: await bcrypt.hash('OldPassword123!', 12),
    });
    await seedRole(prisma, 'USER', 1);
    await seedRole(prisma, 'ADMIN', 99);
    await seedVendorRole(prisma, ADMIN_VENDOR_ID, 99);
  }

  async function issueAdminToken(): Promise<string> {
    return issueLegacyJwt({
      userId: ADMIN_VENDOR_ID.toString(),
      roles: ['ADMIN'],
      email: 'admin-actor@example.com',
      username: 'admin_actor',
      name: 'Admin Actor',
    });
  }

  async function issueNonAdminToken(): Promise<string> {
    return issueLegacyJwt({
      userId: NON_ADMIN_VENDOR_ID.toString(),
      roles: ['USER'],
      email: 'non-admin@example.com',
      username: 'non_admin',
      name: 'Non Admin',
    });
  }

  it('admin guard matrix: unauthorized and non-admin are rejected, admin is allowed', async () => {
    await seedAdminIdentity();
    await seedVendor(prisma, NON_ADMIN_VENDOR_ID, {
      username: 'non_admin',
      email: 'non-admin@example.com',
    });

    await request(app.getHttpServer()).get('/admin/posts/1').expect(401);

    const nonAdminToken = await issueNonAdminToken();
    await request(app.getHttpServer())
      .get('/admin/posts/1')
      .set('authorization', `Bearer ${nonAdminToken}`)
      .expect(401);

    const adminToken = await issueAdminToken();
    await request(app.getHttpServer())
      .get('/admin/posts/1')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /admin/posts/:id returns post details for owner and null for missing post', async () => {
    await seedAdminIdentity();
    await seedPostGraph(prisma, { postId: ADMIN_POST_ID, vendorId: ADMIN_VENDOR_ID });
    await prisma.car_detail.update({
      where: { id: ADMIN_POST_ID },
      data: { registration: '2026' },
    });

    const adminToken = await issueAdminToken();

    const ok = await request(app.getHttpServer())
      .get(`/admin/posts/${ADMIN_POST_ID.toString()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(ok.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        id: ADMIN_POST_ID.toString(),
        vendorId: ADMIN_VENDOR_ID.toString(),
        registration: '2026',
      }),
    });

    const missing = await request(app.getHttpServer())
      .get('/admin/posts/999999999')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(missing.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: null,
    });
  });

  it('DELETE /admin/posts/:id marks post graph as deleted', async () => {
    await seedAdminIdentity();
    await seedPostGraph(prisma, { postId: ADMIN_POST_ID, vendorId: ADMIN_VENDOR_ID });
    const adminToken = await issueAdminToken();

    const response = await request(app.getHttpServer())
      .delete(`/admin/posts/${ADMIN_POST_ID.toString()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Post deleted successfully',
      result: null,
    });

    const post = await prisma.post.findUnique({ where: { id: ADMIN_POST_ID } });
    const details = await prisma.car_detail.findUnique({ where: { id: ADMIN_POST_ID } });
    const search = await prisma.search.findUnique({ where: { id: ADMIN_POST_ID } });

    expect(post?.deleted).toBe(true);
    expect(details?.deleted).toBe(true);
    expect(search?.deleted).toBe('1');
  });

  it('PATCH /admin/posts/:id/sold marks sold status on car_detail and search', async () => {
    await seedAdminIdentity();
    await seedPostGraph(prisma, { postId: ADMIN_POST_ID, vendorId: ADMIN_VENDOR_ID });
    const adminToken = await issueAdminToken();

    const response = await request(app.getHttpServer())
      .patch(`/admin/posts/${ADMIN_POST_ID.toString()}/sold`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Post marked as sold successfully',
      result: null,
    });

    const details = await prisma.car_detail.findUnique({ where: { id: ADMIN_POST_ID } });
    const search = await prisma.search.findUnique({ where: { id: ADMIN_POST_ID } });

    expect(details?.sold).toBe(true);
    expect(search?.sold).toBe(true);
  });

  it('POST /admin/user updates user profile and returns legacy 400 envelope for invalid payload', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const updateResponse = await request(app.getHttpServer())
      .post('/admin/user')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        user: {
          email: 'admin-updated@example.com',
          username: 'admin_updated',
          name: 'Admin Updated',
          password: 'Password123!',
          rewritePassword: 'Password123!',
          phone: '0691111111',
          whatsapp: '0691111111',
          location: 'Durres',
        },
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: true,
    });

    const updated = await prisma.vendor.findUnique({
      where: { id: ADMIN_VENDOR_ID },
      select: {
        email: true,
        username: true,
        name: true,
        phoneNumber: true,
        whatsAppNumber: true,
        location: true,
      },
    });

    expect(updated).toMatchObject({
      email: 'admin-updated@example.com',
      username: 'admin_updated',
      name: 'Admin Updated',
      phoneNumber: '0691111111',
      whatsAppNumber: '0691111111',
      location: 'Durres',
    });

    const invalidPayload = await request(app.getHttpServer())
      .post('/admin/user')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ user: {} })
      .expect(200);

    expect(invalidPayload.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Invalid user payload',
    });
  });

  it('POST /admin/user/change-password updates password hash and handles invalid payload', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const before = await prisma.vendor.findUnique({
      where: { id: ADMIN_VENDOR_ID },
      select: { password: true },
    });

    const success = await request(app.getHttpServer())
      .post('/admin/user/change-password')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        user: {
          email: 'admin-actor@example.com',
          password: 'NewPassword123!',
          rewritePassword: 'NewPassword123!',
        },
      })
      .expect(200);

    expect(success.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: true,
    });

    const after = await prisma.vendor.findUnique({
      where: { id: ADMIN_VENDOR_ID },
      select: { password: true },
    });

    expect(after?.password).toBeTruthy();
    expect(after?.password).not.toBe(before?.password ?? null);
    expect(await bcrypt.compare('NewPassword123!', after?.password ?? '')).toBe(true);

    const invalidPayload = await request(app.getHttpServer())
      .post('/admin/user/change-password')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ user: {} })
      .expect(200);

    expect(invalidPayload.body).toMatchObject({
      success: false,
      statusCode: '400',
      message: 'Invalid user payload',
    });
  });

  it('vendor update endpoints persist contact, biography and profile picture fields', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const contactResponse = await request(app.getHttpServer())
      .post('/admin/vendor/contact')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        vendor: {
          contact: {
            phone_number: '0692222222',
            whatsapp: '0692222222',
            email: 'vendor-contact@example.com',
          },
        },
      })
      .expect(200);

    expect(contactResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Vendor updated successfully',
      result: null,
    });

    await request(app.getHttpServer())
      .post('/admin/vendor/biography')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ vendor: { biography: 'Updated bio for admin vendor' } })
      .expect(200);

    await request(app.getHttpServer())
      .post('/admin/vendor/profile-picture')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ vendor: { profilePicture: 'https://cdn.example.invalid/avatar.webp' } })
      .expect(200);

    const vendor = await prisma.vendor.findUnique({
      where: { id: ADMIN_VENDOR_ID },
      select: {
        contact: true,
        biography: true,
        profilePicture: true,
        initialised: true,
      },
    });

    expect(vendor?.initialised).toBe(true);
    expect(vendor?.biography).toBe('Updated bio for admin vendor');
    expect(vendor?.profilePicture).toBe('https://cdn.example.invalid/avatar.webp');
    expect(vendor?.contact).toContain('vendor-contact@example.com');
  });

  it('DELETE/PATCH admin post mutations fail for non-owner post and keep state unchanged', async () => {
    await seedAdminIdentity();
    await seedVendor(prisma, 8400n, {
      username: 'other_owner',
      email: 'other-owner@example.com',
    });
    await seedPostGraph(prisma, { postId: 8500n, vendorId: 8400n });
    const adminToken = await issueAdminToken();

    const deleteResponse = await request(app.getHttpServer())
      .delete('/admin/posts/8500')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteResponse.body).toMatchObject({
      success: false,
      statusCode: '500',
      message: 'Error while deleting post. Please try again',
    });

    const soldResponse = await request(app.getHttpServer())
      .patch('/admin/posts/8500/sold')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(soldResponse.body).toMatchObject({
      success: false,
      statusCode: '500',
      message: 'Error while marking post as sold. Please try again',
    });

    const post = await prisma.post.findUnique({ where: { id: 8500n } });
    const details = await prisma.car_detail.findUnique({ where: { id: 8500n } });
    expect(post?.deleted).toBe(false);
    expect(details?.sold).toBe(false);
  });
});
