import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

import * as bcrypt from 'bcrypt';

import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';

const MAX_LOGIN_ATTEMPTS = 5;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(identifier: string, password: string) {
    const normalized = identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        deleted: false,
        OR: [{ username: normalized }, { email: normalized }],
      },
    });

    if (!user) {
      // Do NOT leak info
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.blocked) {
      throw new ForbiddenException(
        'Account is locked due to multiple failed login attempts',
      );
    }

    const passwordValid = await this.verifyAndUpgradePassword(
      user.id,
      password,
      user.password,
    );

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, user.attemptedLogin);
      throw new UnauthorizedException('Invalid credentials');
    }

    // ✅ Successful login → reset attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        attemptedLogin: 0,
      },
    });

    const payload = {
      sub: user.id.toString(),
      username: user.username,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    };
  }

  async changePassword(
    userId: bigint,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deleted) {
      throw new UnauthorizedException();
    }

    const valid = await this.verifyAndUpgradePassword(
      user.id,
      currentPassword,
      user.password,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        attemptedLogin: 0,
        blocked: false,
      },
    });

    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deleted: false,
      },
    });

    // Always return success (no user enumeration)
    if (!user) {
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');

    await this.prisma.password_reset_token.create({
      data: {
        userId: user.id,
        token,
        expiresAt: addMinutes(new Date(), 30),
      },
    });

    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset(user.email, link);

    return { success: true };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const record = await this.prisma.password_reset_token.findFirst({
      where: {
        token,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hash,
          blocked: false,
          attemptedLogin: 0,
        },
      }),
      this.prisma.password_reset_token.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    return { success: true };
  }

  /**
   * Handles failed login attempt and blocks account if threshold reached
   */
  private async handleFailedLogin(userId: bigint, currentAttempts: number) {
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          attemptedLogin: newAttempts,
          blocked: true,
        },
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        attemptedLogin: newAttempts,
      },
    });
  }

  /**
   * Verifies password.
   * Automatically upgrades legacy PHP crypt hashes to bcrypt.
   */
  private async verifyAndUpgradePassword(
    userId: bigint,
    plain: string,
    hash: string,
  ): Promise<boolean> {
    // bcrypt hash
    if (hash.startsWith('$2')) {
      return bcrypt.compare(plain, hash);
    }

    // PHP crypt() legacy formats supported by unixcrypt:
    // $6$... => SHA-512 crypt
    // $5$... => SHA-256 crypt
    if (!hash.startsWith('$6$') && !hash.startsWith('$5$')) {
      return false;
    }

    // ESM-only unixcrypt v2+: load via dynamic import
    const { verify } = await import('unixcrypt');
    const legacyValid = verify(plain, hash);
    if (!legacyValid) return false;

    const newHash = await bcrypt.hash(plain, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHash, attemptedLogin: 0 },
    });

    return true;
  }
}
