import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';
import { JwtService } from '@nestjs/jwt';
import { Resend } from 'resend';
import { requireEnv } from '../../common/require-env.util';
import { getUserRoleNames } from '../../common/user-roles.util';
import { createLogger } from '../../common/logger.util';

type AnyRecord = Record<string, unknown>;

const jwtSecret = requireEnv('JWT_SECRET');

type UserPayload = {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  rewritePassword: string;
  phone: string;
  whatsapp: string;
  location: string;
  verificationCode: string;
  roles: Array<{ id: number; name: string }>;
};

type VendorAuthRow = {
  id: bigint;
  name: string | null;
  username: string | null;
  email: string | null;
  password: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  blocked: boolean | number | null;
  deleted: boolean | number | null;
  verificationCode: string | null;
};

@Injectable()
export class LocalUserVendorService {
  private readonly jwtService: JwtService;
  private readonly resetIssuer = 'your.domain.name';
  private readonly logger = createLogger('local-user-vendor-service');

  constructor(private readonly prisma: PrismaService) {
    this.jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: { algorithm: 'HS256' },
    });
  }

  private log(event: string, payload: Record<string, unknown>) {
    this.logger.info(event, payload);
  }

  async createUser(raw: unknown): Promise<LegacyResponse> {
    try {
      const request = this.extractUser(raw);
      if (!request) {
        return legacyError('Invalid user payload', 400);
      }
      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return validityError;
      }

      const isUnique = await this.isUserUnique(request.username, request.email);
      if (!isUnique) {
        return legacyError('User with provided username/email already exists', 409);
      }

      const userId = await this.generateUniqueNumericUserId();
      const now = new Date();
      const passwordHash = await this.encryptPassword(request.password);

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
          INSERT INTO vendor (
            id, dateCreated, dateUpdated, deleted, contact, accountName, profilePicture, accountExists, initialised, biography,
            name, username, email, phoneNumber, whatsAppNumber, location, blocked, attemptedLogin, password, verified, verificationCode, profileImage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          userId,
          now,
          now,
          false,
          '{"phone_number":"","email":"","whatsapp":""}',
          `new vendor ${userId.toString()}`,
          '',
          false,
          false,
          '',
          request.name,
          request.username,
          request.email,
          request.phone || null,
          request.whatsapp || null,
          request.location || null,
          false,
          0,
          passwordHash,
          true,
          null,
          '',
        );

        await tx.$executeRawUnsafe(
          'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
          userId,
          1,
        );
      });

      try {
        await this.sendRegistrationEmail(request.email, request.password);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown email error';
        this.logger.warn('createUser.registration_email_failed', {
          userId: String(userId),
          email: request.email,
          message,
        });
      }
      return legacySuccess(true);
    } catch {
      return legacyError('ERROR: Something went wrong', 500);
    }
  }

  async login(raw: unknown): Promise<LegacyResponse> {
    try {
      const input = (raw ?? {}) as AnyRecord;
      const usernameOrEmail =
        this.toSafeString(input.username) || this.toSafeString(input.email);
      const password = this.toSafeString(input.password);
      this.log('login.start', {
        hasUsernameOrEmail: Boolean(usernameOrEmail),
        hasPassword: Boolean(password),
      });
      if (!usernameOrEmail || !password) {
        this.log('login.invalid_credentials_shape', {
          hasUsernameOrEmail: Boolean(usernameOrEmail),
          hasPassword: Boolean(password),
        });
        return legacyError('Username/email and password are required.', 400);
      }

      const user = await this.findVendorAuthByUsernameOrEmail(usernameOrEmail);

      if (!user) {
        this.log('login.user_not_found', {
          usernameOrEmail,
        });
        return legacyError(
          'Could not login user. Please check your credentials.',
          401,
        );
      }

      const verification = await this.verifyPasswordWithLegacyFallbacks(
        password,
        user.password ?? '',
      );
      if (!verification.ok) {
        this.log('login.password_mismatch', {
          userId: String(user.id),
          username: user.username,
          strategyTried: verification.strategy,
        });
        return legacyError(
          'Could not login user. Please check your credentials.',
          401,
        );
      }
      this.log('login.password_verified', {
        userId: String(user.id),
        username: user.username,
        strategy: verification.strategy,
      });

      if (verification.needsRehash) {
        try {
          const upgradedHash = await this.encryptPassword(password);
          await this.prisma.$executeRawUnsafe(
            'UPDATE vendor SET password = ?, dateUpdated = ? WHERE id = ?',
            upgradedHash,
            new Date(),
            user.id,
          );
          this.log('login.password_rehashed', {
            userId: String(user.id),
            strategy: verification.strategy,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown rehash error';
          this.logger.warn('login.password_rehash_failed', {
            userId: String(user.id),
            message,
          });
        }
      }

      const jwt = await this.jwtService.signAsync({
        iat: Math.floor(Date.now() / 1000),
        iss: this.resetIssuer,
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        userId: String(user.id),
        roles: await getUserRoleNames(this.prisma, String(user.id)),
        name: user.name ?? '',
        email: user.email ?? '',
        username: user.username ?? '',
      });
      this.log('login.success', {
        userId: String(user.id),
        username: user.username,
      });

      return legacySuccess(jwt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown login error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('login.exception', { message, stack });
      return legacyError(
        'Could not login user. Please check your credentials.',
        401,
      );
    }
  }

  private async verifyPasswordWithLegacyFallbacks(
    plainPassword: string,
    storedPassword: string,
  ): Promise<{ ok: boolean; strategy: string; needsRehash: boolean }> {
    // Legacy crypt($6$...) compatibility.
    try {
      const unixcrypt = require('unixcrypt') as typeof import('unixcrypt');
      const hashedInput = unixcrypt.encrypt(plainPassword, storedPassword);
      if (hashedInput === storedPassword) {
        return { ok: true, strategy: 'unixcrypt', needsRehash: true };
      }
    } catch {
      // Continue to next strategy.
    }

    // Bcrypt compatibility for historical $2y$/$2a$/$2b$ hashes.
    if (
      storedPassword.startsWith('$2y$') ||
      storedPassword.startsWith('$2a$') ||
      storedPassword.startsWith('$2b$')
    ) {
      try {
        const bcrypt = require('bcrypt') as typeof import('bcrypt');
        const normalizedHash = storedPassword.startsWith('$2y$')
          ? `$2b$${storedPassword.slice(4)}`
          : storedPassword;
        const ok = await bcrypt.compare(plainPassword, normalizedHash);
        if (ok) {
          const rounds = this.getBcryptRounds(normalizedHash);
          const needsRehash =
            storedPassword.startsWith('$2y$') ||
            storedPassword.startsWith('$2a$') ||
            (rounds !== null && rounds < 12);
          return { ok: true, strategy: 'bcrypt', needsRehash };
        }
      } catch {
        // Continue to next strategy.
      }
    }

    return { ok: false, strategy: 'all_failed', needsRehash: false };
  }

  async resetPassword(raw: unknown): Promise<LegacyResponse> {
    try {
      const email = this.extractEmail(raw);
      if (!email) {
        return legacyError('Email is required', 400);
      }

      const user = await this.findVendorAuthByEmail(email);
      if (!user) {
        return legacyError('User not found', 404);
      }

      const code = this.generateRandomCode(15);
      const verificationToken = await this.jwtService.signAsync(
        {
          userId: String(user.id),
          token: code,
          iss: this.resetIssuer,
          nbf: Math.floor(Date.now() / 1000),
        },
        {
          expiresIn: '30m',
        },
      );

      await this.prisma.$executeRawUnsafe(
        'UPDATE vendor SET verificationCode = ?, dateUpdated = ? WHERE id = ?',
        verificationToken,
        new Date(),
        user.id,
      );

      await this.sendResetPasswordEmail(email, code);
      return legacySuccess(true);
    } catch {
      return legacyError('Failed to reset password', 500);
    }
  }

  async verifyPassword(raw: unknown): Promise<LegacyResponse> {
    try {
      const input = raw as AnyRecord;
      const email = this.toSafeString(input.email);
      const verificationCode = this.toSafeString(input.verificationCode);
      const newPassword = this.toSafeString(input.newPassword);

      if (!email || !verificationCode || !newPassword) {
        return legacyError(
          'Email, verification code or new password was not provided. Please check you request.',
          400,
        );
      }

      const user = await this.findVendorAuthByEmail(email);
      if (!user || !user.verificationCode) {
        return legacyError(`User with email: ${email} was not found.`, 404);
      }

      const decoded = await this.jwtService.verifyAsync<{
        userId: string;
        token: string;
        iss: string;
        nbf: number;
        exp: number;
      }>(user.verificationCode);

      const now = Math.floor(Date.now() / 1000);
      const isCodeValid =
        String(decoded.userId) === String(user.id) &&
        decoded.token === verificationCode &&
        decoded.iss === this.resetIssuer &&
        decoded.nbf <= now &&
        decoded.exp >= now;

      if (!isCodeValid) {
        return legacyError('Invalid or expired reset code', 401);
      }

      await this.prisma.$executeRawUnsafe(
        'UPDATE vendor SET password = ?, verificationCode = NULL, dateUpdated = ? WHERE id = ?',
        await this.encryptPassword(newPassword),
        new Date(),
        user.id,
      );

      return legacySuccess(true);
    } catch {
      return legacyError('Password could not be reset', 500);
    }
  }

  async updateUser(userId: string, rawUser: unknown): Promise<LegacyResponse> {
    try {
      const request = this.extractUser({ user: rawUser });
      if (!request) {
        return legacyError('Invalid user payload', 400);
      }

      if (request.id && String(request.id) !== String(userId)) {
        return legacyError('User id mismatch', 400);
      }
      request.id = String(userId);

      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return validityError;
      }

      const isUnique = await this.isUsernameAndEmailUnique(
        request.username,
        request.email,
        request.id,
      );
      if (!isUnique) {
        return legacyError('User with provided username/email already exists', 409);
      }

      await this.prisma.$executeRawUnsafe(
        `
        UPDATE vendor
        SET
          name = ?,
          username = ?,
          email = ?,
          phoneNumber = ?,
          whatsAppNumber = ?,
          location = ?,
          dateUpdated = ?
        WHERE id = ?
        `,
        request.name,
        request.username,
        request.email,
        request.phone || null,
        request.whatsapp || null,
        request.location || null,
        new Date(),
        BigInt(userId),
      );

      await this.prisma.$executeRawUnsafe(
        'DELETE FROM vendor_role WHERE vendor_id = ?',
        BigInt(userId),
      );
      await this.prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
        BigInt(userId),
        1,
      );

      return legacySuccess(true);
    } catch {
      return legacyError('Could not update user.', 500);
    }
  }

  async changePassword(
    userId: string,
    rawUser: unknown,
  ): Promise<LegacyResponse> {
    try {
      const request = this.extractUser({ user: rawUser });
      if (!request) {
        return legacyError('Invalid user payload', 400);
      }

      if (request.id && String(request.id) !== String(userId)) {
        return legacyError('User id mismatch', 400);
      }

      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return validityError;
      }

      if (!request.password || request.password !== request.rewritePassword) {
        return legacyError('Provided passwords were not the same.', 400);
      }

      await this.prisma.$executeRawUnsafe(
        'UPDATE vendor SET password = ?, dateUpdated = ? WHERE id = ?',
        await this.encryptPassword(request.password),
        new Date(),
        BigInt(userId),
      );

      return legacySuccess(true);
    } catch {
      return legacyError('Could not update user.', 500);
    }
  }

  async updateVendorContact(
    userId: string,
    vendor: unknown,
  ): Promise<LegacyResponse> {
    return this.updateVendorDetails(userId, vendor);
  }

  async updateVendorBiography(
    userId: string,
    vendor: unknown,
  ): Promise<LegacyResponse> {
    return this.updateVendorDetails(userId, vendor);
  }

  async updateVendorProfilePicture(
    userId: string,
    vendor: unknown,
  ): Promise<LegacyResponse> {
    return this.updateVendorDetails(userId, vendor);
  }

  private async updateVendorDetails(
    userId: string,
    vendorRaw: unknown,
  ): Promise<LegacyResponse> {
    try {
      const vendorRequest = this.extractVendor(vendorRaw);
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: BigInt(userId) },
      });
      if (!vendor) {
        return legacyError('Could not update vendor', 500);
      }

      const updates: Record<string, unknown> = {
        dateUpdated: new Date(),
        initialised: true,
      };

      if (vendorRequest.biography) {
        updates.biography = vendorRequest.biography;
      }
      if (vendorRequest.contact) {
        updates.contact = JSON.stringify(vendorRequest.contact);
      }
      if (vendorRequest.profilePicture) {
        updates.profilePicture = vendorRequest.profilePicture;
      }

      await this.prisma.vendor.update({
        where: { id: BigInt(userId) },
        data: updates,
      });

      return legacySuccess(null, 'Vendor updated successfully');
    } catch {
      return legacyError('Could not update vendor', 500);
    }
  }

  private extractUser(raw: unknown): UserPayload | null {
    const root = (raw ?? {}) as AnyRecord;
    const userObject = (root.user ?? root) as AnyRecord;

    const email = this.toSafeString(userObject.email);
    if (!this.isValidEmail(email)) {
      return null;
    }

    return {
      id: this.toSafeString(userObject.id),
      name: this.toSafeString(userObject.name),
      username: this.toSafeString(userObject.username),
      email,
      password: this.toSafeString(userObject.password),
      rewritePassword: this.toSafeString(userObject.rewritePassword),
      phone: this.toSafeString(userObject.phone),
      whatsapp: this.toSafeString(userObject.whatsapp),
      location: this.toSafeString(userObject.location),
      verificationCode: this.toSafeString(userObject.verificationCode),
      roles: [{ id: 1, name: 'USER' }],
    };
  }

  private extractVendor(raw: unknown): {
    biography: string | null;
    contact: AnyRecord | null;
    profilePicture: string | null;
  } {
    const vendor = (raw ?? {}) as AnyRecord;
    const contact = vendor.contact;

    return {
      biography: this.toSafeNullableString(vendor.biography),
      contact:
        contact && typeof contact === 'object' ? (contact as AnyRecord) : null,
      profilePicture: this.toSafeNullableString(vendor.profilePicture),
    };
  }

  private extractEmail(raw: unknown): string {
    const input = (raw ?? {}) as AnyRecord;
    return this.toSafeString(input.email);
  }

  private validateCreateOrUpdateRequest(user: {
    password: string;
    rewritePassword: string;
    roles: unknown[];
  }): LegacyResponse | null {
    if (user.password !== user.rewritePassword) {
      return legacyError('Provided passwords were not the same.', 400);
    }
    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      return legacyError('No role was provided for the user', 400);
    }
    return null;
  }

  private async isUserUnique(
    username: string,
    email: string,
  ): Promise<boolean> {
    if (!username) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        'SELECT COUNT(*) as total FROM vendor WHERE deleted = 0 AND (username = ? OR email = ?)',
        email,
        email,
      );
      return Number(rows[0]?.total ?? 0n) === 0;
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      'SELECT COUNT(*) as total FROM vendor WHERE deleted = 0 AND (username = ? OR email = ?)',
      username,
      email,
    );
    return Number(rows[0]?.total ?? 0n) === 0;
  }

  private async isUsernameAndEmailUnique(
    username: string,
    email: string,
    id: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
      `
      SELECT id
      FROM vendor
      WHERE deleted = 0 AND (username = ? OR email = ?)
      `,
      username,
      email,
    );

    if (rows.length === 0) return true;
    if (rows.length > 1) return false;
    return String(rows[0]?.id ?? '') === String(id);
  }

  private async generateUniqueNumericUserId(): Promise<bigint> {
    for (let i = 0; i < 100; i += 1) {
      const candidate = BigInt(this.generateRandomCode(15, true));
      const existing = await this.prisma.vendor.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }

    throw new Error('Unable to generate unique user id');
  }

  private async encryptPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt') as typeof import('bcrypt');
    return bcrypt.hash(password, 12);
  }

  private getBcryptRounds(hash: string): number | null {
    const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  }

  private generateRandomCode(length: number, onlyNumbers = false): string {
    const chars = onlyNumbers
      ? '0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async sendRegistrationEmail(
    email: string,
    password: string,
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'info@autoconnect.al',
      to: [email],
      subject: 'Mire se erde ne Autoconnect',
      html: `
        <strong>Mire se erde ne Autoconnect</strong>
        <br/>
        <p>
          Llogaria juaj eshte krijuar me sukses. Per ta aksesuar ate, ju mund te kyceni
          ne llogarine tuaj duke klikuar <a href="https://autoconnect.al/login">kete link</a>.
          <br/>
          Emaili juaj eshte: <strong>${email}</strong>
          <br/>
          Passwordi juaj eshte: <strong>${password}</strong>
          <br/>
          Ju rekomandojme te ndryshoni passwordin tuaj pas pare se ky email.
        </p>
        <br/>
        <p>
          Faleminderit,
          <br/>
          Ekipi i Autoconnect
        </p>
      `,
    });
  }

  private async sendResetPasswordEmail(
    email: string,
    code: string,
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'info@autoconnect.al',
      to: [email],
      subject: 'Kerkese per rikuperimin e fjalekalimit',
      html: `
        <strong>Kerkese per rikuperimin e fjalekalimit</strong>
        <br/>
        <p>
          Nje kerkese per rikuperimin e fjalekalimit eshte bere per llogarine tuaj.
          Kodi i rikuperimit eshte: <b>${code}</b>.
          <br/>
          Ky kodi eshte i vlefshem per 30 minuta.
          <br/>
          Nese nuk e keni bere kete kerkese, ju lutem injoroni kete email.
        </p>
        <br/>
        <p>
          Faleminderit,
          <br/>
          Ekipi i Autoconnect
        </p>
      `,
    });
  }

  private isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toSafeNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private async findVendorAuthByUsernameOrEmail(
    usernameOrEmail: string,
  ): Promise<VendorAuthRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<VendorAuthRow[]>(
      `
      SELECT
        id, name, username, email, password, phoneNumber AS phone, whatsAppNumber AS whatsapp, location,
        blocked, deleted, verificationCode
      FROM vendor
      WHERE (username = ? OR email = ?) AND deleted = 0 AND blocked = 0
      LIMIT 1
      `,
      usernameOrEmail,
      usernameOrEmail,
    );
    return rows[0] ?? null;
  }

  private async findVendorAuthByEmail(
    email: string,
  ): Promise<VendorAuthRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<VendorAuthRow[]>(
      `
      SELECT
        id, name, username, email, password, phoneNumber AS phone, whatsAppNumber AS whatsapp, location,
        blocked, deleted, verificationCode
      FROM vendor
      WHERE email = ? AND deleted = 0
      LIMIT 1
      `,
      email,
    );
    return rows[0] ?? null;
  }
}
