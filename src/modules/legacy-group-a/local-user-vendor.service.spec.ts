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
});
