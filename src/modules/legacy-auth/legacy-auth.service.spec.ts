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
});
