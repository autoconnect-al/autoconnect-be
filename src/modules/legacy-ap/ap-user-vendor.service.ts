import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';

type AnyRecord = Record<string, unknown>;

@Injectable()
export class ApUserVendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localUserVendorService: LocalUserVendorService,
  ) {}

  async getUsers() {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE deleted = 0
      ORDER BY dateCreated DESC
      LIMIT 500
      `,
    );
    const roleMap = await this.getRoleMap(
      users.map((row) => BigInt(String(row.id))),
    );
    return legacySuccess(users.map((row) => this.mapUser(row, roleMap)));
  }

  async getUserById(id: string) {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE id = ? AND deleted = 0
      LIMIT 1
      `,
      BigInt(id),
    );
    const user = users[0];
    if (!user) {
      return legacyError(`No user could be found for id: ${id}`);
    }
    const roleMap = await this.getRoleMap([BigInt(String(user.id))]);
    return legacySuccess(this.mapUser(user, roleMap), id);
  }

  async getUserByUsername(username: string) {
    const users = await this.prisma.$queryRawUnsafe<AnyRecord[]>(
      `
      SELECT
        id,
        name,
        username,
        email,
        phoneNumber AS phone,
        whatsAppNumber AS whatsapp,
        location
      FROM vendor
      WHERE username = ? AND deleted = 0
      LIMIT 1
      `,
      username,
    );
    const user = users[0];
    if (!user) {
      return legacyError(`No user could be found for username: ${username}`);
    }

    const roleMap = await this.getRoleMap([BigInt(String(user.id))]);
    return legacySuccess(this.mapUser(user, roleMap), username);
  }

  async createUser(rawUser: unknown) {
    return this.localUserVendorService.createUser(rawUser);
  }

  async updateUser(id: string, rawUser: unknown) {
    return this.localUserVendorService.updateUser(id, rawUser);
  }

  async deleteUser(id: string) {
    const userId = BigInt(id);
    const vendor = await this.prisma.vendor.findUnique({ where: { id: userId } });
    if (!vendor) {
      return legacyError(`Could not delete user.`);
    }

    await this.prisma.vendor.update({
      where: { id: userId },
      data: { deleted: true, dateUpdated: new Date() },
    });

    return legacySuccess(id);
  }

  async updateVendorByAdmin(id: string, rawVendor: unknown) {
    const vendor = this.extractVendor(rawVendor);
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: {
        biography: vendor.biography,
        contact: vendor.contact ? JSON.stringify(vendor.contact) : undefined,
        dateUpdated: new Date(),
      },
    });
    return legacySuccess(null, 'Vendor updated successfully');
  }

  async deleteVendorByAdmin(id: string) {
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: { deleted: true, dateUpdated: new Date() },
    });
    return legacySuccess(null, 'Vendor deleted successfully');
  }

  private async getRoleMap(
    userIds: bigint[],
  ): Promise<Map<string, Array<{ id: number; name: string }>>> {
    const map = new Map<string, Array<{ id: number; name: string }>>();
    if (userIds.length === 0) return map;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ vendor_id: bigint; role_id: number; role_name: string }>
    >(
      `
      SELECT vr.vendor_id, vr.role_id, r.name as role_name
      FROM vendor_role vr
      INNER JOIN role r ON r.id = vr.role_id
      WHERE vr.vendor_id IN (${userIds.map(() => '?').join(',')})
      `,
      ...userIds,
    );

    for (const row of rows) {
      const key = String(row.vendor_id);
      const current = map.get(key) ?? [];
      current.push({ id: Number(row.role_id), name: row.role_name });
      map.set(key, current);
    }

    return map;
  }

  private mapUser(
    user: AnyRecord,
    roleMap: Map<string, Array<{ id: number; name: string }>>,
  ) {
    const id = String(user.id ?? '');
    return {
      id,
      name: this.toSafeString(user.name),
      username: this.toSafeString(user.username),
      email: this.toSafeString(user.email),
      phone: this.toSafeString(user.phone),
      whatsapp: this.toSafeString(user.whatsapp),
      location: this.toSafeString(user.location),
      roles: roleMap.get(id) ?? [{ id: 1, name: 'USER' }],
    };
  }

  private extractVendor(rawVendor: unknown): {
    id: string;
    accountName: string;
    biography: string;
    profilePicture: string;
    contact: AnyRecord | null;
  } {
    const root = (rawVendor ?? {}) as AnyRecord;
    const source = root.vendor ?? root;
    const vendor =
      typeof source === 'string'
        ? (this.parseJsonObject(source) ?? {})
        : ((source as AnyRecord) ?? {});

    return {
      id: this.toSafeString(vendor.id),
      accountName: this.toSafeString(vendor.accountName),
      biography: this.toSafeString(vendor.biography),
      profilePicture: this.toSafeString(vendor.profilePicture),
      contact:
        vendor.contact && typeof vendor.contact === 'object'
          ? (vendor.contact as AnyRecord)
          : this.parseJsonObject(vendor.contact),
    };
  }

  private parseJsonObject(value: unknown): AnyRecord | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AnyRecord;
      }
      return null;
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
}
