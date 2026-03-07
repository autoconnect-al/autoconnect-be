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

jest.setTimeout(180_000);

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

  it('admin guard matrix: unauthorized is rejected, authenticated users are owner-scoped', async () => {
    await seedAdminIdentity();
    await seedVendor(prisma, NON_ADMIN_VENDOR_ID, {
      username: 'non_admin',
      email: 'non-admin@example.com',
    });

    await request(app.getHttpServer()).get('/admin/posts/1').expect(401);

    const nonAdminToken = await issueNonAdminToken();
    const nonAdminResponse = await request(app.getHttpServer())
      .get('/admin/posts/1')
      .set('authorization', `Bearer ${nonAdminToken}`)
      .expect(200);
    expect(nonAdminResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: null,
    });

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
    await prisma.post.update({
      where: { id: ADMIN_POST_ID },
      data: {
        impressions: 55,
        reach: 44,
        clicks: 18,
        contact: 6,
        contactCall: 2,
        contactWhatsapp: 2,
        contactEmail: 1,
        contactInstagram: 1,
      },
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
        impressions: 55,
        reach: 44,
        clicks: 18,
        contactCount: 6,
        contactCall: 2,
        contactWhatsapp: 2,
        contactEmail: 1,
        contactInstagram: 1,
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

  it('GET /admin/posts/:id treats row as deleted when car_detail.deleted is true', async () => {
    await seedAdminIdentity();
    await seedPostGraph(prisma, { postId: ADMIN_POST_ID, vendorId: ADMIN_VENDOR_ID });
    await prisma.post.update({
      where: { id: ADMIN_POST_ID },
      data: { deleted: false },
    });
    await prisma.car_detail.update({
      where: { id: ADMIN_POST_ID },
      data: { deleted: true },
    });

    const adminToken = await issueAdminToken();
    const response = await request(app.getHttpServer())
      .get(`/admin/posts/${ADMIN_POST_ID.toString()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
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

  it('POST /admin/vendor/site-config persists validated config and GET /admin/user returns parsed value', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const siteConfig = {
      version: 1,
      theme: {
        components: {
          hero: {
            '--builder-bg': '#ffffff',
            '--builder-accent': '#f5351f',
          },
          mediaText: {
            '--builder-media-image-height-desktop': '340px',
            '--builder-media-text-align-desktop': 'center',
          },
          richText: {
            '--builder-richtext-text-color': '#334155',
            '--builder-richtext-text-size': '18px',
            '--builder-richtext-text-weight': '600',
            '--builder-richtext-text-decoration': 'underline',
            '--builder-richtext-surface': 'transparent',
            '--builder-richtext-border-color': '#cbd5e1',
            '--builder-richtext-border-width': '0px',
            '--builder-richtext-padding': '24px 20px',
            '--builder-richtext-margin': '0 0 28px',
          },
        },
        navigation: {
          variant: 'floating',
          position: 'bottom',
          mobileMenu: {
            mode: 'fullscreen',
            motion: 'left',
          },
        },
      },
      pages: {
        home: {
          sections: [
            {
              id: 'home-hero',
              type: 'hero',
              data: {
                heading: 'Welcome to Auto Connect',
                subheading: 'Trusted vehicles for every budget',
                variant: 'fullWidth',
                contentAlign: 'center',
                background: {
                  mode: 'image',
                  imageUrl: 'https://cdn.example.invalid/hero-banner.jpg',
                  overlay: {
                    color: '#000000',
                    opacity: 0.4,
                  },
                },
                cta: { label: 'Browse vehicles', url: '/sq-al/vehicles' },
              },
            },
            {
              id: 'home-media',
              type: 'mediaText',
              data: {
                title: 'Trusted inventory',
                body: 'Preview media styling controls for desktop layout.',
                mediaPosition: 'right',
                imageHeightPx: 460,
                textAlign: 'left',
                mediaUrl: 'https://cdn.example.invalid/media.jpg',
              },
              styleTokens: {
                '--builder-media-image-height-desktop': '420px',
                '--builder-media-text-align-desktop': 'center',
              },
            },
          ],
        },
        about: {
          sections: [
            {
              id: 'about-rich',
              type: 'richText',
              data: {
                paragraphs: ['We have served customers for over 10 years.'],
              },
              styleTokens: {
                '--builder-richtext-text-weight': '700',
                '--builder-richtext-padding': '28px 24px',
              },
            },
          ],
        },
        contact: {
          sections: [
            {
              id: 'contact-form',
              type: 'contactForm',
              data: {
                title: 'Contact us',
                submitLabel: 'Send message',
              },
            },
          ],
        },
      },
    };

    const saveResponse = await request(app.getHttpServer())
      .post('/admin/vendor/site-config')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        vendor: {
          siteConfig,
        },
      })
      .expect(200);

    expect(saveResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      message: 'Vendor updated successfully',
      result: null,
    });

    const vendor = await prisma.vendor.findUnique({
      where: { id: ADMIN_VENDOR_ID },
      select: { siteConfig: true },
    });

    expect(vendor?.siteConfig).toBeTruthy();
    expect(vendor?.siteConfig).toContain('"version":1');

    const getUserResponse = await request(app.getHttpServer())
      .get('/admin/user')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getUserResponse.body).toMatchObject({
      success: true,
      statusCode: '200',
      result: expect.objectContaining({
        vendor: expect.objectContaining({
          siteConfig: expect.objectContaining({
            version: 1,
            theme: expect.objectContaining({
              navigation: expect.objectContaining({
                variant: 'floating',
                position: 'bottom',
                mobileMenu: expect.objectContaining({
                  mode: 'fullscreen',
                  motion: 'left',
                }),
              }),
            }),
            pages: expect.objectContaining({
              home: expect.objectContaining({
                sections: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'hero',
                    data: expect.objectContaining({
                      variant: 'fullWidth',
                      contentAlign: 'center',
                      background: expect.objectContaining({
                        mode: 'image',
                      }),
                    }),
                  }),
                  expect.objectContaining({
                    type: 'mediaText',
                    data: expect.objectContaining({
                      mediaPosition: 'right',
                      imageHeightPx: 460,
                      textAlign: 'left',
                    }),
                    styleTokens: expect.objectContaining({
                      '--builder-media-image-height-desktop': '420px',
                      '--builder-media-text-align-desktop': 'center',
                    }),
                  }),
                ]),
              }),
              about: expect.objectContaining({
                sections: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'richText',
                    styleTokens: expect.objectContaining({
                      '--builder-richtext-text-weight': '700',
                      '--builder-richtext-padding': '28px 24px',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('POST /admin/vendor/site-config returns validation errors for invalid payloads', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const oversizedPayloadString = `{"version":1,"pages":{"home":{"sections":[]},"about":{"sections":[]},"contact":{"sections":[]}},"filler":"${'x'.repeat(
      95_000,
    )}"}`;
    const cases = [
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'hero-bad-variant',
                  type: 'hero',
                  data: { heading: 'Valid heading', variant: 'wide' },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'variant must be one of inset or fullWidth',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'hero-bad-overlay',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                    background: {
                      mode: 'image',
                      imageUrl: 'https://cdn.example.invalid/hero.jpg',
                      overlay: {
                        color: '#000000',
                        opacity: 4,
                      },
                    },
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'overlay.opacity must be between 0 and 1',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'hero-bad-gradient',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                    background: {
                      mode: 'gradient',
                      gradient: {
                        from: '#111111',
                        to: '#222222',
                        angle: 800,
                      },
                    },
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'gradient.angle must be between 0 and 360',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'media-bad-height',
                  type: 'mediaText',
                  data: {
                    title: 'Valid title',
                    body: 'Valid body',
                    imageHeightPx: 1200,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'imageHeightPx must be an integer between 180 and 900',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'media-bad-align',
                  type: 'mediaText',
                  data: {
                    title: 'Valid title',
                    body: 'Valid body',
                    textAlign: 'right',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'textAlign must be one of left or center',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [{ id: 'one', type: 'unknown', data: {} }],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'type is not supported',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: { sections: [] },
            about: { sections: [] },
            contact: {
              sections: [
                {
                  id: 'map-1',
                  type: 'map',
                  data: { embedUrl: 'javascript:alert(1)' },
                },
              ],
            },
          },
        },
        expectedMessage: 'protocol is not allowed',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'hero-1',
                  type: 'hero',
                  data: { heading: 'Valid heading' },
                  styleTokens: { '--not-allowed-token': '#fff' },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'not an allowed token',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'media-token-height-bad',
                  type: 'mediaText',
                  data: {
                    title: 'Valid title',
                    body: 'Valid body',
                  },
                  styleTokens: {
                    '--builder-media-image-height-desktop': '90px',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be between 180px and 900px',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'media-token-align-bad',
                  type: 'mediaText',
                  data: {
                    title: 'Valid title',
                    body: 'Valid body',
                  },
                  styleTokens: {
                    '--builder-media-text-align-desktop': 'right',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be one of left or center',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'richtext-bad-size',
                  type: 'richText',
                  data: {
                    paragraphs: ['Valid paragraph'],
                  },
                  styleTokens: {
                    '--builder-richtext-text-size': '9px',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be between 12px and 48px',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'richtext-bad-weight',
                  type: 'richText',
                  data: {
                    paragraphs: ['Valid paragraph'],
                  },
                  styleTokens: {
                    '--builder-richtext-text-weight': '950',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be normal, bold, or 100..900',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'richtext-bad-decoration',
                  type: 'richText',
                  data: {
                    paragraphs: ['Valid paragraph'],
                  },
                  styleTokens: {
                    '--builder-richtext-text-decoration': 'blink',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be one of none, underline, line-through or overline',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'richtext-bad-spacing',
                  type: 'richText',
                  data: {
                    paragraphs: ['Valid paragraph'],
                  },
                  styleTokens: {
                    '--builder-richtext-padding': '10px auto',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be in Npx format',
      },
      {
        siteConfig: {
          version: 1,
          theme: {
            navigation: {
              variant: 'compact',
            },
          },
          pages: {
            home: { sections: [] },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'variant must be one of floating or fullWidth',
      },
      {
        siteConfig: {
          version: 1,
          theme: {
            navigation: {
              mobileMenu: {
                mode: 'sheet',
              },
            },
          },
          pages: {
            home: { sections: [] },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'mobileMenu.mode must be fullscreen',
      },
      {
        siteConfig: oversizedPayloadString,
        expectedMessage: 'payload is too large',
      },
    ];

    for (const testCase of cases) {
      const response = await request(app.getHttpServer())
        .post('/admin/vendor/site-config')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          vendor: {
            siteConfig: testCase.siteConfig,
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: false,
        statusCode: '400',
      });
      expect(String(response.body.message)).toContain(testCase.expectedMessage);
    }
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
