import { LocalUserVendorService } from './local-user-vendor.service';
import { PrismaService } from '../../database/prisma.service';

jest.mock(
  'unixcrypt',
  () => ({
    encrypt: (plain: string, saltOrHash: string) =>
      plain === 'secret123' && saltOrHash === '$6$legacy' ? '$6$legacy' : '$6$other',
  }),
  { virtual: true },
);

class MockPrismaService {
  $executeRawUnsafe = jest.fn();
}

describe('LocalUserVendorService password migration', () => {
  let service: LocalUserVendorService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = new MockPrismaService();
    service = new LocalUserVendorService(prisma as unknown as PrismaService);
  });

  it('encryptPassword should use bcrypt format', async () => {
    const hash = await (service as any).encryptPassword('secret123');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifyPasswordWithLegacyFallbacks should mark unixcrypt hashes for rehash', async () => {
    const unixcrypt = require('unixcrypt') as typeof import('unixcrypt');
    const legacyHash = unixcrypt.encrypt('secret123', '$6$legacy');

    const result = await (service as any).verifyPasswordWithLegacyFallbacks(
      'secret123',
      legacyHash,
    );

    expect(result.ok).toBe(true);
    expect(result.strategy).toBe('unixcrypt');
    expect(result.needsRehash).toBe(true);
  });

  it('login should rehash password when legacy strategy is detected', async () => {
    (service as any).findVendorAuthByUsernameOrEmail = jest.fn().mockResolvedValue({
      id: 1n,
      username: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      password: 'legacy-hash',
      deleted: false,
      blocked: false,
    });
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    (service as any).verifyPasswordWithLegacyFallbacks = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        strategy: 'unixcrypt',
        needsRehash: true,
      });
    (service as any).encryptPassword = jest
      .fn()
      .mockResolvedValue('$2b$12$newhash');
    (service as any).jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
    };

    const response = await service.login({
      username: 'admin',
      password: 'secret123',
    });

    expect(response.success).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'UPDATE vendor SET password = ?, dateUpdated = ? WHERE id = ?',
      '$2b$12$newhash',
      expect.any(Date),
      1n,
    );
  });

  it('login should return 401 when an unexpected auth exception occurs', async () => {
    (service as any).findVendorAuthByUsernameOrEmail = jest
      .fn()
      .mockRejectedValue(new Error('db fail'));

    const response = await service.login({
      username: 'admin',
      password: 'secret123',
    });

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe('401');
  });

  it('extractUser should parse legacy urlencoded JSON payload', () => {
    const parsed = (service as any).extractUser({
      '{"user":{"name":"Test","email":"test@example.com","password":"Test1234!","rewritePassword":"Test1234!"}}':
        '',
    });

    expect(parsed).not.toBeNull();
    expect(parsed.email).toBe('test@example.com');
    expect(parsed.username).toBe('test@example.com');
    expect(parsed.name).toBe('Test');
    expect(parsed.password).toBe('Test1234!');
    expect(parsed.rewritePassword).toBe('Test1234!');
  });

  it('extractUser should use email as username when username is missing', () => {
    const parsed = (service as any).extractUser({
      user: {
        name: 'Rei Pano',
        email: 'test@tralalalalalala.com',
        password: 'Test12345!',
        rewritePassword: 'Test12345!',
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed.username).toBe('test@tralalalalalala.com');
    expect(parsed.email).toBe('test@tralalalalalala.com');
  });

  it('resetPassword should accept legacy urlencoded JSON payload', async () => {
    (service as any).findVendorAuthByEmail = jest.fn().mockResolvedValue({ id: 1n });
    (service as any).generateRandomCode = jest.fn().mockReturnValue('ABC123');
    (service as any).jwtService = {
      signAsync: jest.fn().mockResolvedValue('verification-token'),
    };
    (service as any).sendResetPasswordEmail = jest.fn().mockResolvedValue(undefined);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const response = await service.resetPassword({
      '{"email":"test@example.com"}': '',
    });

    expect((service as any).findVendorAuthByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );
    expect((service as any).sendResetPasswordEmail).toHaveBeenCalledWith(
      'test@example.com',
      'ABC123',
    );
    expect(response.success).toBe(true);
  });

  it('verifyPassword should accept JSON string payload', async () => {
    const now = Math.floor(Date.now() / 1000);
    (service as any).findVendorAuthByEmail = jest.fn().mockResolvedValue({
      id: 1n,
      verificationCode: 'stored-reset-token',
    });
    (service as any).jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        userId: '1',
        token: 'ABC123',
        iss: 'your.domain.name',
        nbf: now - 60,
        exp: now + 1800,
      }),
    };
    (service as any).encryptPassword = jest
      .fn()
      .mockResolvedValue('$2b$12$newhash');
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const response = await service.verifyPassword(
      JSON.stringify({
        email: 'test@example.com',
        verificationCode: 'ABC123',
        newPassword: 'StrongPass123!',
      }),
    );

    expect((service as any).findVendorAuthByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'UPDATE vendor SET password = ?, verificationCode = NULL, dateUpdated = ? WHERE id = ?',
      '$2b$12$newhash',
      expect.any(Date),
      1n,
    );
    expect(response.success).toBe(true);
  });
});
