import { ApRoleService } from './ap-role.service';

describe('ApRoleService admin role management', () => {
  it('grants ADMIN role to existing user', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, deleted: false }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 9 }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    } as any;

    const service = new ApRoleService(prisma);
    const response = await service.grantAdminRole('7');

    expect(response.success).toBe(true);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('prevents revoking the last ADMIN role', async () => {
    const prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, deleted: false }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 9 }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ total: 1n }])
        .mockResolvedValueOnce([{ total: 1n }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    } as any;

    const service = new ApRoleService(prisma);
    const response = await service.revokeAdminRole('7');

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe('409');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
