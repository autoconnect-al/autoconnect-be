describe('LegacyAuthService', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    process.env.INSTAGRAM_CLIENT_ID =
      process.env.INSTAGRAM_CLIENT_ID || 'test-client-id';
    process.env.INSTAGRAM_CLIENT_SECRET =
      process.env.INSTAGRAM_CLIENT_SECRET || 'test-client-secret';
    process.env.INSTAGRAM_REDIRECT_URI =
      process.env.INSTAGRAM_REDIRECT_URI ||
      'https://example.com/sq-al/paneli-administrimit';
    process.env.GOOGLE_CLIENT_ID =
      process.env.GOOGLE_CLIENT_ID || 'google-client-id';
  });

  it('loginLocal should return 401 when underlying login throws', async () => {
    // Load after env setup because service reads required envs at module scope.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LegacyAuthService } = require('./legacy-auth.service');

    const localUserVendorService = {
      login: jest.fn().mockRejectedValue(new Error('auth backend down')),
    } as any;
    const prisma = {} as any;

    const service = new LegacyAuthService(localUserVendorService, prisma);
    const response = await service.loginLocal({
      username: 'admin',
      password: 'secret123',
    });

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe('401');
    expect(response.message).toBe(
      'Could not login user. Please check your credentials.',
    );
  });

  it('loginGoogle should return jwt for an existing linked account', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LegacyAuthService } = require('./legacy-auth.service');
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: process.env.GOOGLE_CLIENT_ID,
        sub: 'google-sub-1',
        email: 'linked@example.com',
        email_verified: 'true',
        name: 'Linked User',
      }),
    } as any);

    const localUserVendorService = {} as any;
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: BigInt(10),
            name: 'Linked User',
            username: 'linked_user',
            email: 'linked@example.com',
            blocked: false,
            deleted: false,
          },
        ]),
    } as any;

    const service = new LegacyAuthService(localUserVendorService, prisma);
    const response = await service.loginGoogle({
      idToken: 'google-id-token',
    });

    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('jwt');
    expect(typeof response.result.jwt).toBe('string');
    global.fetch = originalFetch;
  });

  it('loginGoogle should create-link account by email when provider link is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LegacyAuthService } = require('./legacy-auth.service');
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: process.env.GOOGLE_CLIENT_ID,
        sub: 'google-sub-2',
        email: 'existing@example.com',
        email_verified: 'true',
        name: 'Existing User',
      }),
    } as any);

    const localUserVendorService = {} as any;
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: BigInt(33),
            name: 'Existing User',
            username: 'existing_user',
            email: 'existing@example.com',
            blocked: false,
            deleted: false,
          },
        ]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    } as any;

    const service = new LegacyAuthService(localUserVendorService, prisma);
    const response = await service.loginGoogle({
      idToken: 'google-id-token',
    });

    expect(response.success).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(response.result).toHaveProperty('jwt');
    global.fetch = originalFetch;
  });

  it('loginGoogle should accept boolean true for email_verified', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LegacyAuthService } = require('./legacy-auth.service');
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: process.env.GOOGLE_CLIENT_ID,
        sub: 'google-sub-bool',
        email: 'bool@example.com',
        email_verified: true,
        name: 'Boolean Verified',
      }),
    } as any);

    const localUserVendorService = {} as any;
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([
        {
          id: BigInt(44),
          name: 'Boolean Verified',
          username: 'bool_user',
          email: 'bool@example.com',
          blocked: false,
          deleted: false,
        },
      ]),
    } as any;

    const service = new LegacyAuthService(localUserVendorService, prisma);
    const response = await service.loginGoogle({
      idToken: 'google-id-token',
    });

    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('jwt');
    global.fetch = originalFetch;
  });

  it('loginGoogle should work for linked account even when email is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LegacyAuthService } = require('./legacy-auth.service');
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: process.env.GOOGLE_CLIENT_ID,
        sub: 'google-sub-linked-no-email',
        email_verified: true,
        name: 'Linked Without Email',
      }),
    } as any);

    const localUserVendorService = {} as any;
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([
        {
          id: BigInt(55),
          name: 'Linked Without Email',
          username: 'linked_no_email',
          email: 'linked@example.com',
          blocked: false,
          deleted: false,
        },
      ]),
    } as any;

    const service = new LegacyAuthService(localUserVendorService, prisma);
    const response = await service.loginGoogle({
      idToken: 'google-id-token',
    });

    expect(response.success).toBe(true);
    expect(response.result).toHaveProperty('jwt');
    global.fetch = originalFetch;
  });
});
