import { Injectable } from '@nestjs/common';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { LocalUserVendorService } from '../legacy-group-a/local-user-vendor.service';
import {
  extractLegacyBearerToken,
  verifyAndDecodeLegacyJwtPayload,
} from '../../common/legacy-auth.util';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { requireEnv } from '../../common/require-env.util';
import { getUserRoleNames } from '../../common/user-roles.util';
import { createLogger } from '../../common/logger.util';

const jwtSecret = requireEnv('JWT_SECRET');
const instagramClientId = requireEnv('INSTAGRAM_CLIENT_ID');
const instagramClientSecret = requireEnv('INSTAGRAM_CLIENT_SECRET');
const instagramRedirectUri = requireEnv('INSTAGRAM_REDIRECT_URI');
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const DEFAULT_CREATED_VENDOR_ROLE_ID = 2;

@Injectable()
export class LegacyAuthService {
  private readonly jwtService: JwtService;
  private readonly logger = createLogger('legacy-auth-service');

  constructor(
    private readonly localUserVendorService: LocalUserVendorService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: { algorithm: 'HS256' },
    });
  }

  pending(feature: string) {
    return legacyError(`Migration pending for ${feature}`, 501);
  }

  async loginLocal(body: unknown) {
    try {
      return await this.localUserVendorService.login(body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown auth service error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('login.exception', { message, stack });
      return legacyError(
        'Could not login user. Please check your credentials.',
        401,
      );
    }
  }

  async refreshTokenLocal(headers: Record<string, unknown>) {
    try {
      const token = extractLegacyBearerToken(headers);
      if (!token) {
        return legacyError(
          'Could not refresh token. Please check your credentials.',
          401,
        );
      }

      const payload = verifyAndDecodeLegacyJwtPayload(token);
      const userId = typeof payload?.userId === 'string' ? payload.userId : '';
      if (!userId) {
        return legacyError(
          'Could not refresh token. Please check your credentials.',
          401,
        );
      }

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: bigint;
          name: string | null;
          username: string | null;
          email: string | null;
          deleted: boolean | number | null;
          blocked: boolean | number | null;
        }>
      >(
        `
        SELECT id, name, username, email, deleted, blocked
        FROM vendor
        WHERE id = ?
        LIMIT 1
        `,
        BigInt(userId),
      );
      const user = rows[0];
      if (!user || user.deleted || user.blocked) {
        return legacyError(
          'Could not refresh token. Please check your credentials.',
          401,
        );
      }

      const newToken = await this.jwtService.signAsync({
        iat: Math.floor(Date.now() / 1000),
        iss: 'your.domain.name',
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        userId: String(user.id),
        roles: await getUserRoleNames(this.prisma, String(user.id)),
        name: user.name ?? '',
        email: user.email ?? '',
        username: user.username ?? '',
      });

      return legacySuccess({ jwt: newToken });
    } catch {
      return legacyError(
        'Could not refresh token. Please check your credentials.',
        401,
      );
    }
  }

  async createUserLocal(body: unknown) {
    return this.localUserVendorService.createUser(body);
  }

  async resetPasswordLocal(body: unknown) {
    return this.localUserVendorService.resetPassword(body);
  }

  async verifyPasswordLocal(body: unknown) {
    return this.localUserVendorService.verifyPassword(body);
  }

  async getInstagramAccessToken(code?: string) {
    if (!code || code.trim().length === 0) {
      return legacyError(
        'Could not get access token. Please check your data.',
        400,
      );
    }

    const clientId = instagramClientId;
    const clientSecret = instagramClientSecret;
    const redirectUri = instagramRedirectUri;

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code.trim(),
      });

      const accessTokenResponse = await fetch(
        'https://api.instagram.com/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body,
        },
      );

      const shortLivedPayload = (await accessTokenResponse.json()) as {
        access_token?: string;
      };

      if (!shortLivedPayload.access_token) {
        return legacyError(
          'Could not get access token. Please check your data.',
          400,
        );
      }

      const longLivedUrl = new URL('https://graph.instagram.com/access_token');
      longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
      longLivedUrl.searchParams.set('client_secret', clientSecret);
      longLivedUrl.searchParams.set(
        'access_token',
        shortLivedPayload.access_token,
      );

      const longLivedResponse = await fetch(longLivedUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const longLivedPayload = (await longLivedResponse.json()) as {
        access_token?: string;
        expires_in?: number;
      };

      if (!longLivedPayload.access_token) {
        return legacyError(
          'Could not get long-lived access token. Please check your data.',
          400,
        );
      }

      return legacySuccess({
        access_token: longLivedPayload.access_token,
        expires_in: longLivedPayload.expires_in ?? null,
      });
    } catch {
      return legacyError(
        'Could not get access token. Please check your data.',
        500,
      );
    }
  }

  async loginGoogle(body: unknown) {
    const payload = (body ?? {}) as Record<string, unknown>;
    const idToken = this.toSafeString(payload.idToken);
    if (!idToken) {
      return legacyError(
        'Could not login user. Please check your credentials.',
        400,
      );
    }

    try {
      const profile = await this.fetchGoogleProfileFromIdToken(idToken);
      if (!profile?.sub) {
        return legacyError(
          'Could not login user. Please check your credentials.',
          401,
        );
      }
      if (!profile.emailVerified) {
        return legacyError(
          'Could not login user. Please verify your Google account email first.',
          401,
        );
      }

      const socialLoginResult = await this.findOrCreateGoogleUser(profile);
      const user = socialLoginResult.user;
      if (!user || user.deleted || user.blocked) {
        return legacyError(
          'Could not login user. Please check your credentials.',
          401,
        );
      }

      if (socialLoginResult.generatedPassword) {
        try {
          await this.localUserVendorService.sendRegistrationCredentialsEmail(
            user.email ?? '',
            socialLoginResult.generatedPassword,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown registration email error';
          this.logger.warn('loginGoogle.registration_email_failed', {
            email: profile.email,
            message,
          });
        }
      }

      const jwt = await this.signLegacyJwt(user);
      return legacySuccess({
        jwt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown social login error';
      this.logger.error('loginGoogle.exception', { message });
      return legacyError(
        'Could not login user. Please check your credentials.',
        401,
      );
    }
  }

  private async fetchGoogleProfileFromIdToken(idToken: string): Promise<{
    sub: string;
    email: string;
    emailVerified: boolean;
    name: string;
    givenName: string;
    familyName: string;
    picture: string;
    aud: string;
  } | null> {
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', idToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const audience = this.toSafeString(payload.aud);
    if (googleClientId && audience !== googleClientId) {
      return null;
    }

    const emailVerifiedRaw = payload.email_verified;
    const emailVerified =
      emailVerifiedRaw === true ||
      this.toSafeString(emailVerifiedRaw).toLowerCase() === 'true' ||
      this.toSafeString(emailVerifiedRaw) === '1';

    return {
      sub: this.toSafeString(payload.sub),
      email: this.toSafeString(payload.email).toLowerCase(),
      emailVerified,
      name: this.toSafeString(payload.name),
      givenName: this.toSafeString(payload.given_name),
      familyName: this.toSafeString(payload.family_name),
      picture: this.toSafeString(payload.picture),
      aud: audience,
    };
  }

  private async findOrCreateGoogleUser(profile: {
    sub: string;
    email: string;
    emailVerified: boolean;
    name: string;
    givenName: string;
    familyName: string;
    picture: string;
    aud: string;
  }): Promise<{
    user: {
      id: bigint;
      name: string | null;
      username: string | null;
      email: string | null;
      blocked: boolean | number | null;
      deleted: boolean | number | null;
    } | null;
    generatedPassword: string | null;
  }> {
    const linkedRows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        name: string | null;
        username: string | null;
        email: string | null;
        blocked: boolean | number | null;
        deleted: boolean | number | null;
      }>
    >(
      `
      SELECT v.id, v.name, v.username, v.email, v.blocked, v.deleted
      FROM vendor_oauth_account voa
      INNER JOIN vendor v ON v.id = voa.vendor_id
      WHERE voa.provider = ? AND voa.provider_user_id = ? AND voa.deleted = 0
      LIMIT 1
      `,
      'google',
      profile.sub,
    );

    if (linkedRows[0]) {
      return { user: linkedRows[0], generatedPassword: null };
    }

    if (!profile.email) {
      return { user: null, generatedPassword: null };
    }

    const existingByEmail = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        name: string | null;
        username: string | null;
        email: string | null;
        blocked: boolean | number | null;
        deleted: boolean | number | null;
      }>
    >(
      `
      SELECT id, name, username, email, blocked, deleted
      FROM vendor
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      profile.email.toLowerCase(),
    );

    if (existingByEmail[0]) {
      await this.linkOauthAccount({
        vendorId: existingByEmail[0].id,
        provider: 'google',
        providerUserId: profile.sub,
        email: profile.email,
      });
      return { user: existingByEmail[0], generatedPassword: null };
    }

    const now = new Date();
    const userId = await this.generateUniqueNumericUserId();
    const username = this.generateSocialUsername(profile.email);
    const displayName =
      profile.name || profile.givenName || this.emailPrefix(profile.email);
    const generatedPassword = this.generateRandomPassword(14);
    const passwordHash = await this.encryptPassword(generatedPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
        INSERT INTO vendor (
          id, dateCreated, dateUpdated, deleted, contact, accountName, profilePicture, accountExists, initialised,
          isVendor, isNormalUser, isReposter, biography,
          name, username, email, phoneNumber, whatsAppNumber, location, blocked, attemptedLogin, password, verified, verificationCode, profileImage
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        userId,
        now,
        now,
        false,
        '{"phone_number":"","email":"","whatsapp":""}',
        displayName,
        profile.picture || '',
        true,
        true,
        true,
        false,
        false,
        '',
        displayName,
        username,
        profile.email,
        null,
        null,
        null,
        false,
        0,
        passwordHash,
        true,
        null,
        profile.picture || '',
      );

      await tx.$executeRawUnsafe(
        'INSERT IGNORE INTO vendor_role (vendor_id, role_id) VALUES (?, ?)',
        userId,
        DEFAULT_CREATED_VENDOR_ROLE_ID,
      );

      await tx.$executeRawUnsafe(
        `
        INSERT INTO vendor_oauth_account
        (vendor_id, provider, provider_user_id, email, dateCreated, dateUpdated, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor_id = VALUES(vendor_id),
          email = VALUES(email),
          deleted = 0,
          dateUpdated = VALUES(dateUpdated)
        `,
        userId,
        'google',
        profile.sub,
        profile.email,
        now,
        now,
        false,
      );
    });

    const createdRows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        name: string | null;
        username: string | null;
        email: string | null;
        blocked: boolean | number | null;
        deleted: boolean | number | null;
      }>
    >(
      `
      SELECT id, name, username, email, blocked, deleted
      FROM vendor
      WHERE id = ?
      LIMIT 1
      `,
      userId,
    );
    return { user: createdRows[0] ?? null, generatedPassword };
  }

  private async linkOauthAccount(params: {
    vendorId: bigint;
    provider: string;
    providerUserId: string;
    email: string;
  }) {
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO vendor_oauth_account
      (vendor_id, provider, provider_user_id, email, dateCreated, dateUpdated, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vendor_id = VALUES(vendor_id),
        email = VALUES(email),
        deleted = 0,
        dateUpdated = VALUES(dateUpdated)
      `,
      params.vendorId,
      params.provider,
      params.providerUserId,
      params.email,
      now,
      now,
      false,
    );
  }

  private async signLegacyJwt(user: {
    id: bigint;
    name: string | null;
    username: string | null;
    email: string | null;
  }): Promise<string> {
    return this.jwtService.signAsync({
      iat: Math.floor(Date.now() / 1000),
      iss: 'your.domain.name',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      userId: String(user.id),
      roles: await getUserRoleNames(this.prisma, String(user.id)),
      name: user.name ?? '',
      email: user.email ?? '',
      username: user.username ?? '',
    });
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async generateUniqueNumericUserId(): Promise<bigint> {
    for (let i = 0; i < 8; i += 1) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ maxId: bigint }>>(
        'SELECT COALESCE(MAX(id), 0) AS maxId FROM vendor',
      );
      const nextId = (rows[0]?.maxId ?? BigInt(0)) + BigInt(1);
      const exists = await this.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
        'SELECT id FROM vendor WHERE id = ? LIMIT 1',
        nextId,
      );
      if (!exists[0]) {
        return nextId;
      }
    }
    throw new Error('Could not allocate vendor id for social login');
  }

  private generateSocialUsername(email: string): string {
    const prefix = this.emailPrefix(email).replace(/[^a-zA-Z0-9._-]/g, '');
    const suffix = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0');
    return `${prefix || 'google_user'}_${suffix}`;
  }

  private generateRandomPassword(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async encryptPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt') as typeof import('bcrypt');
    return bcrypt.hash(password, 12);
  }

  private emailPrefix(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex < 1) {
      return '';
    }
    return email.slice(0, atIndex);
  }
}
