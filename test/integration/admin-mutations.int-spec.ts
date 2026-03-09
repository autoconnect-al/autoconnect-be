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
          testimonials: {
            '--builder-testimonials-quote-color': '#0f172a',
            '--builder-testimonials-quote-size': '20px',
            '--builder-testimonials-quote-weight': '700',
            '--builder-testimonials-quote-decoration': 'none',
            '--builder-testimonials-meta-color': '#64748b',
            '--builder-testimonials-meta-size': '14px',
            '--builder-testimonials-meta-weight': '500',
            '--builder-testimonials-meta-decoration': 'none',
          },
          footer: {
            '--builder-footer-brand-color': '#f8fafc',
            '--builder-footer-brand-size': '22px',
            '--builder-footer-brand-weight': '700',
            '--builder-footer-brand-decoration': 'none',
            '--builder-footer-description-color': '#94a3b8',
            '--builder-footer-description-size': '14px',
            '--builder-footer-description-weight': '400',
            '--builder-footer-description-decoration': 'none',
            '--builder-footer-group-title-color': '#e2e8f0',
            '--builder-footer-group-title-size': '16px',
            '--builder-footer-group-title-weight': '600',
            '--builder-footer-group-title-decoration': 'none',
            '--builder-footer-link-color': '#e2e8f0',
            '--builder-footer-link-size': '15px',
            '--builder-footer-link-weight': '500',
            '--builder-footer-link-decoration': 'none',
            '--builder-footer-social-color': '#ffffff',
            '--builder-footer-social-size': '14px',
            '--builder-footer-social-weight': '500',
            '--builder-footer-social-decoration': 'none',
            '--builder-footer-copyright-color': '#94a3b8',
            '--builder-footer-copyright-size': '13px',
            '--builder-footer-copyright-weight': '400',
            '--builder-footer-copyright-decoration': 'none',
          },
        },
        navigation: {
          variant: 'floating',
          position: 'bottom',
          marginTopPx: 14,
          marginRightPx: 10,
          marginBottomPx: 18,
          marginLeftPx: 8,
          mobileMenu: {
            mode: 'fullscreen',
            motion: 'left',
          },
          styleTokens: {
            '--builder-nav-bg': '#0f172a',
            '--builder-nav-text-color': '#e2e8f0',
            '--builder-nav-text-size': '17px',
            '--builder-nav-text-weight': '600',
            '--builder-nav-text-style': 'normal',
            '--builder-nav-text-decoration': 'none',
            '--builder-nav-brand-size': '20px',
          },
        },
      },
      pages: {
        home: {
          sections: [
            {
              id: 'home-hero',
              type: 'hero',
              layout: {
                wrapper: 'sectionContent',
                minHeightPx: 320,
                marginTopPx: 16,
                marginBottomPx: 28,
              },
              data: {
                heading: 'Welcome to Auto Connect',
                subheading: 'Trusted vehicles for every budget',
                variant: 'fullWidth',
                contentAlign: 'center',
                background: {
                  mode: 'image',
                  imageUrl: 'https://cdn.example.invalid/hero-banner.jpg',
                  imageFit: 'contain',
                  imagePositionX: 'right',
                  imagePositionY: 'bottom',
                  imageRepeat: 'repeat-x',
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
              layout: {
                wrapper: 'none',
                minHeightPx: 260,
                heightPx: 500,
                marginBottomPx: 12,
              },
              data: {
                title: 'Trusted inventory',
                body: 'Preview media styling controls for desktop layout.',
                mediaPosition: 'right',
                imageHeightMobilePx: 260,
                imageHeightDesktopPx: 460,
                desktopFromBreakpoint: 'lg',
                textAlign: 'left',
                mediaUrl: 'https://cdn.example.invalid/media.jpg',
              },
              styleTokens: {
                '--builder-media-image-height-desktop': '420px',
                '--builder-media-text-align-desktop': 'center',
              },
            },
            {
              id: 'home-testimonials',
              type: 'testimonials',
              data: {
                variant: 'grid',
                itemsPerViewDesktop: 3,
                items: Array.from({ length: 11 }, (_, index) => ({
                  quote: `Quote ${index + 1}`,
                  author: `Author ${index + 1}`,
                  role: 'Buyer',
                })),
              },
              styleTokens: {
                '--builder-testimonials-quote-decoration': 'underline',
                '--builder-testimonials-meta-weight': '700',
              },
            },
            {
              id: 'home-carousel',
              type: 'imageCarousel',
              layout: {
                wrapper: 'none',
                minHeightPx: 280,
                heightPx: 420,
              },
              data: {
                slides: [
                  {
                    variant: 'plain',
                    imageUrl: 'https://cdn.example.invalid/slide-plain.jpg',
                    imageAlt: 'Plain slide',
                  },
                  {
                    variant: 'overlay',
                    imageUrl: 'https://cdn.example.invalid/slide-overlay.jpg',
                    title: 'Overlay headline',
                    description: 'Overlay description',
                    cta: {
                      label: 'Browse vehicles',
                      url: '/sq-al/vehicles',
                    },
                  },
                  {
                    variant: 'split',
                    imageUrl: 'https://cdn.example.invalid/slide-split.jpg',
                    title: 'Split headline',
                    description: 'Split description',
                    imagePosition: 'right',
                    cta: {
                      label: 'About vendor',
                      url: '/sq-al/about',
                    },
                  },
                ],
              },
            },
          ],
        },
        about: {
          sections: [
            {
              id: 'about-rich',
              type: 'richText',
              layout: {
                wrapper: 'section',
                minHeightPx: 300,
              },
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
              layout: {
                wrapper: 'section',
                minHeightPx: 340,
              },
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
                marginTopPx: 14,
                marginRightPx: 10,
                marginBottomPx: 18,
                marginLeftPx: 8,
                mobileMenu: expect.objectContaining({
                  mode: 'fullscreen',
                  motion: 'left',
                }),
                styleTokens: expect.objectContaining({
                  '--builder-nav-bg': '#0f172a',
                  '--builder-nav-text-size': '17px',
                  '--builder-nav-brand-size': '20px',
                }),
              }),
              components: expect.objectContaining({
                footer: expect.objectContaining({
                  '--builder-footer-brand-size': '22px',
                  '--builder-footer-link-weight': '500',
                  '--builder-footer-copyright-color': '#94a3b8',
                }),
              }),
            }),
            pages: expect.objectContaining({
              home: expect.objectContaining({
                sections: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'hero',
                    layout: expect.objectContaining({
                      wrapper: 'sectionContent',
                      minHeightPx: 320,
                      marginTopPx: 16,
                      marginBottomPx: 28,
                    }),
                    data: expect.objectContaining({
                      variant: 'fullWidth',
                      contentAlign: 'center',
                      background: expect.objectContaining({
                        mode: 'image',
                        imageFit: 'contain',
                        imagePositionX: 'right',
                        imagePositionY: 'bottom',
                        imageRepeat: 'repeat-x',
                      }),
                    }),
                  }),
                  expect.objectContaining({
                    type: 'mediaText',
                    layout: expect.objectContaining({
                      wrapper: 'none',
                      minHeightPx: 260,
                      heightPx: 500,
                      marginBottomPx: 12,
                    }),
                    data: expect.objectContaining({
                      mediaPosition: 'right',
                      imageHeightMobilePx: 260,
                      imageHeightDesktopPx: 460,
                      desktopFromBreakpoint: 'lg',
                      textAlign: 'left',
                    }),
                    styleTokens: expect.objectContaining({
                      '--builder-media-image-height-desktop': '420px',
                      '--builder-media-text-align-desktop': 'center',
                    }),
                  }),
                  expect.objectContaining({
                    type: 'testimonials',
                    data: expect.objectContaining({
                      variant: 'grid',
                      itemsPerViewDesktop: 3,
                      items: expect.any(Array),
                    }),
                    styleTokens: expect.objectContaining({
                      '--builder-testimonials-quote-decoration': 'underline',
                      '--builder-testimonials-meta-weight': '700',
                    }),
                  }),
                  expect.objectContaining({
                    type: 'imageCarousel',
                    layout: expect.objectContaining({
                      wrapper: 'none',
                      minHeightPx: 280,
                      heightPx: 420,
                    }),
                    data: expect.objectContaining({
                      slides: expect.arrayContaining([
                        expect.objectContaining({
                          variant: 'plain',
                          imageUrl: 'https://cdn.example.invalid/slide-plain.jpg',
                        }),
                        expect.objectContaining({
                          variant: 'overlay',
                          imageUrl: 'https://cdn.example.invalid/slide-overlay.jpg',
                          title: 'Overlay headline',
                        }),
                        expect.objectContaining({
                          variant: 'split',
                          imageUrl: 'https://cdn.example.invalid/slide-split.jpg',
                          imagePosition: 'right',
                        }),
                      ]),
                    }),
                  }),
                ]),
              }),
              about: expect.objectContaining({
                sections: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'richText',
                    layout: expect.objectContaining({
                      wrapper: 'section',
                      minHeightPx: 300,
                    }),
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

    const persistedHomeSections = getUserResponse.body?.result?.vendor?.siteConfig?.pages?.home?.sections ?? [];
    const persistedTestimonials = persistedHomeSections.find(
      (section: unknown) => (section as { type?: string })?.type === 'testimonials',
    ) as { data?: { items?: Array<{ quote?: string; author?: string }> } } | undefined;
    expect(persistedTestimonials?.data?.items).toHaveLength(9);
    expect(persistedTestimonials?.data?.items?.[0]).toMatchObject({
      quote: 'Quote 1',
      author: 'Author 1',
    });
    expect(persistedTestimonials?.data?.items?.[8]).toMatchObject({
      quote: 'Quote 9',
      author: 'Author 9',
    });

    const persistedCarousel = persistedHomeSections.find(
      (section: unknown) => (section as { type?: string })?.type === 'imageCarousel',
    ) as {
      data?: {
        slides?: Array<{
          variant?: string;
          overlay?: { color?: string; opacity?: number };
          imagePosition?: string;
        }>;
      };
    } | undefined;
    expect(persistedCarousel?.data?.slides).toHaveLength(3);
    expect(persistedCarousel?.data?.slides?.[1]).toMatchObject({
      variant: 'overlay',
      overlay: {
        color: '#000000',
        opacity: 0.35,
      },
    });
    expect(persistedCarousel?.data?.slides?.[2]).toMatchObject({
      variant: 'split',
      imagePosition: 'right',
    });
  });

  it('POST /admin/vendor/site-config accepts legacy imageCarousel.images payload', async () => {
    await seedAdminIdentity();
    const adminToken = await issueAdminToken();

    const siteConfig = {
      version: 1,
      pages: {
        home: {
          sections: [
            {
              id: 'home-carousel-legacy',
              type: 'imageCarousel',
              data: {
                images: [
                  {
                    url: 'https://cdn.example.invalid/legacy-1.jpg',
                    alt: 'Legacy one',
                  },
                  {
                    url: 'https://cdn.example.invalid/legacy-2.jpg',
                  },
                ],
              },
            },
          ],
        },
        about: { sections: [] },
        contact: { sections: [] },
      },
    };

    await request(app.getHttpServer())
      .post('/admin/vendor/site-config')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        vendor: {
          siteConfig,
        },
      })
      .expect(200);

    const getUserResponse = await request(app.getHttpServer())
      .get('/admin/user')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const persistedHomeSections = getUserResponse.body?.result?.vendor?.siteConfig?.pages?.home?.sections ?? [];
    const persistedCarousel = persistedHomeSections.find(
      (section: unknown) => (section as { type?: string })?.type === 'imageCarousel',
    ) as { data?: { images?: Array<{ url?: string; alt?: string }> } } | undefined;

    expect(persistedCarousel?.data?.images).toEqual([
      {
        url: 'https://cdn.example.invalid/legacy-1.jpg',
        alt: 'Legacy one',
      },
      {
        url: 'https://cdn.example.invalid/legacy-2.jpg',
      },
    ]);
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
                  id: 'hero-bad-image-fit',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                    background: {
                      mode: 'image',
                      imageUrl: 'https://cdn.example.invalid/hero.jpg',
                      imageFit: 'fill',
                    },
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'imageFit must be one of cover, contain or auto',
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
                    imageHeightPx: 2201,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'imageHeightPx must be an integer between 80 and 2000',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'media-bad-breakpoint',
                  type: 'mediaText',
                  data: {
                    title: 'Valid title',
                    body: 'Valid body',
                    desktopFromBreakpoint: 'xxl',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'desktopFromBreakpoint must be one of sm, md, lg or xl',
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
              sections: [
                {
                  id: 'testimonials-bad-variant',
                  type: 'testimonials',
                  data: {
                    variant: 'masonry',
                    items: [
                      {
                        quote: 'Valid quote',
                        author: 'Valid author',
                      },
                    ],
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'variant must be one of grid or carousel',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'testimonials-bad-items-per-view',
                  type: 'testimonials',
                  data: {
                    variant: 'carousel',
                    itemsPerViewDesktop: 4,
                    items: [
                      {
                        quote: 'Valid quote',
                        author: 'Valid author',
                      },
                    ],
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'itemsPerViewDesktop must be an integer between 1 and 3',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-bad-wrapper',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'fluid',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.wrapper must be one of section, sectionContent or none',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-bad-min-height',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'section',
                    minHeightPx: 90,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.minHeightPx must be an integer between 120 and 1600',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-bad-height',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'section',
                    heightPx: 1700,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.heightPx must be an integer between 120 and 1600',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-height-lt-min',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'sectionContent',
                    minHeightPx: 500,
                    heightPx: 320,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.heightPx must be greater than or equal to',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-bad-margin-top',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'section',
                    marginTopPx: -1,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.marginTopPx must be an integer between 0 and 240',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'layout-bad-margin-bottom',
                  type: 'hero',
                  data: {
                    heading: 'Valid heading',
                  },
                  layout: {
                    wrapper: 'section',
                    marginBottomPx: 280,
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'layout.marginBottomPx must be an integer between 0 and 240',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'carousel-bad-variant',
                  type: 'imageCarousel',
                  data: {
                    slides: [
                      {
                        variant: 'video',
                        imageUrl: 'https://cdn.example.invalid/slide.jpg',
                      },
                    ],
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'variant must be one of plain, overlay or split',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'carousel-bad-image-position',
                  type: 'imageCarousel',
                  data: {
                    slides: [
                      {
                        variant: 'split',
                        imageUrl: 'https://cdn.example.invalid/slide.jpg',
                        title: 'Valid title',
                        description: 'Valid description',
                        imagePosition: 'top',
                      },
                    ],
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'imagePosition must be one of left or right',
      },
      {
        siteConfig: {
          version: 1,
          pages: {
            home: {
              sections: [
                {
                  id: 'carousel-bad-overlay-opacity',
                  type: 'imageCarousel',
                  data: {
                    slides: [
                      {
                        variant: 'overlay',
                        imageUrl: 'https://cdn.example.invalid/slide.jpg',
                        title: 'Valid title',
                        description: 'Valid description',
                        overlay: {
                          color: '#000000',
                          opacity: 2,
                        },
                      },
                    ],
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
                  id: 'carousel-bad-url',
                  type: 'imageCarousel',
                  data: {
                    slides: [
                      {
                        variant: 'plain',
                        imageUrl: 'javascript:alert(1)',
                      },
                    ],
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'protocol is not allowed',
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
                    '--builder-media-image-height-desktop': '79px',
                  },
                },
              ],
            },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'must be between 80px and 2000px',
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
                  id: 'testimonials-token-size-bad',
                  type: 'testimonials',
                  data: {
                    items: [
                      {
                        quote: 'Valid quote',
                        author: 'Valid author',
                      },
                    ],
                  },
                  styleTokens: {
                    '--builder-testimonials-quote-size': '10px',
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
                  id: 'testimonials-token-decoration-bad',
                  type: 'testimonials',
                  data: {
                    items: [
                      {
                        quote: 'Valid quote',
                        author: 'Valid author',
                      },
                    ],
                  },
                  styleTokens: {
                    '--builder-testimonials-meta-decoration': 'blink',
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
                  id: 'footer-token-size-bad',
                  type: 'footer',
                  data: {
                    brandTitle: 'Valid footer',
                  },
                  styleTokens: {
                    '--builder-footer-brand-size': '9px',
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
                  id: 'footer-token-decoration-bad',
                  type: 'footer',
                  data: {
                    brandTitle: 'Valid footer',
                  },
                  styleTokens: {
                    '--builder-footer-link-decoration': 'blink',
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
              marginRightPx: 280,
            },
          },
          pages: {
            home: { sections: [] },
            about: { sections: [] },
            contact: { sections: [] },
          },
        },
        expectedMessage: 'marginRightPx must be an integer between 0 and 240',
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
