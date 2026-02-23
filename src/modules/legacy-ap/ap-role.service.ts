import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class ApRoleService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoles() {
    const rows = await this.prisma.role.findMany({
      where: { deleted: false },
      orderBy: { id: 'asc' },
    });
    return legacySuccess(rows.map((row) => this.normalizeBigInts(row)));
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: Number(id) },
    });
    if (!role || role.deleted) {
      return legacyError(`No user could be found for id: ${id}`);
    }
    return legacySuccess(this.normalizeBigInts(role), id);
  }

  async createRole(rawRole: unknown) {
    const role = this.extractRole(rawRole);
    if (!role?.name) return legacyError('Entity could not be added');

    const existing = await this.prisma.role.findFirst({
      where: {
        name: role.name,
        deleted: false,
      },
    });
    if (existing) return legacyError('Entity could not be added');

    await this.prisma.role.create({
      data: {
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        name: role.name,
      },
    });
    return legacySuccess(true);
  }

  async updateRole(id: string, rawRole: unknown) {
    const role = this.extractRole(rawRole);
    if (!role?.name) return legacyError('Role could not be added');

    const roleId = Number(id);
    if (!Number.isInteger(roleId))
      return legacyError('Role could not be added');

    const existing = await this.prisma.role.findFirst({
      where: {
        id: { not: roleId },
        name: role.name,
        deleted: false,
      },
    });
    if (existing) return legacyError('Role could not be added');

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: role.name,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(true);
  }

  async deleteRole(id: string) {
    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return legacyError('Entity id could not be found in the request.');
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        deleted: true,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(id);
  }

  async grantAdminRole(userId: string) {
    const parsedUserId = this.parseNumericId(userId);
    if (!parsedUserId) {
      return legacyError('Invalid user id.', 400);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: parsedUserId },
      select: { id: true, deleted: true },
    });
    if (!vendor || vendor.deleted) {
      return legacyError('User not found.', 404);
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'ADMIN', deleted: false },
      select: { id: true },
    });
    if (!adminRole) {
      return legacyError('ADMIN role is not configured.', 500);
    }

    await this.prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
      parsedUserId,
      adminRole.id,
    );

    return legacySuccess(true, 'Admin role granted successfully');
  }

  async revokeAdminRole(userId: string) {
    const parsedUserId = this.parseNumericId(userId);
    if (!parsedUserId) {
      return legacyError('Invalid user id.', 400);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: parsedUserId },
      select: { id: true, deleted: true },
    });
    if (!vendor || vendor.deleted) {
      return legacyError('User not found.', 404);
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'ADMIN', deleted: false },
      select: { id: true },
    });
    if (!adminRole) {
      return legacyError('ADMIN role is not configured.', 500);
    }

    const adminLinks = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE role_id = ?',
      adminRole.id,
    );
    const totalAdmins = Number(adminLinks[0]?.total ?? 0n);

    const targetLink = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      'SELECT COUNT(*) AS total FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      parsedUserId,
      adminRole.id,
    );
    const targetHasAdmin = Number(targetLink[0]?.total ?? 0n) > 0;

    if (targetHasAdmin && totalAdmins <= 1) {
      return legacyError('Cannot remove the last ADMIN user.', 409);
    }

    await this.prisma.$executeRawUnsafe(
      'DELETE FROM vendor_role WHERE vendor_id = ? AND role_id = ?',
      parsedUserId,
      adminRole.id,
    );

    return legacySuccess(true, 'Admin role revoked successfully');
  }

  private extractRole(raw: unknown): { id: string; name: string } | null {
    const root = (raw ?? {}) as AnyRecord;
    const roleInput = root.role ?? root;

    if (typeof roleInput === 'string') {
      try {
        const parsed = JSON.parse(roleInput) as AnyRecord;
        return {
          id: this.toSafeString(parsed.id),
          name: this.toSafeString(parsed.name),
        };
      } catch {
        return {
          id: '',
          name: this.toSafeString(roleInput),
        };
      }
    }

    if (!roleInput || typeof roleInput !== 'object') return null;
    const role = roleInput as AnyRecord;
    return {
      id: this.toSafeString(role.id),
      name: this.toSafeString(role.name),
    };
  }

  private parseNumericId(id: string): bigint | null {
    const normalized = this.toSafeString(id);
    if (!normalized || !/^\d+$/.test(normalized)) {
      return null;
    }
    try {
      return BigInt(normalized);
    } catch {
      return null;
    }
  }

  private toSafeString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
