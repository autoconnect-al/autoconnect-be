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
}
