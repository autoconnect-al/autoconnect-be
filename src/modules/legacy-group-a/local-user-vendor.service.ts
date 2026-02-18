import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  legacyError,
  legacySuccess,
  type LegacyResponse,
} from '../../common/legacy-response';
import { JwtService } from '@nestjs/jwt';
import { Resend } from 'resend';

type AnyRecord = Record<string, unknown>;

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

@Injectable()
export class LocalUserVendorService {
  private readonly jwtService: JwtService;
  private readonly resetIssuer = 'your.domain.name';

  constructor(private readonly prisma: PrismaService) {
    this.jwtService = new JwtService({
      secret:
        process.env.JWT_SECRET ??
        `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgHhtbw0Ojj24oDS1NFTg4jJaNNulbn1tAYlgTaoua1Fogkmtbhed
p3wMaJu0PHrCNM4DZeBA1XxpQcDuTSLukkSVRGqRsrSB3UyRfc3ykINN0/nQmTvh
C3WxyOF/xTAfa3r4d/aMs+knBtBvXR8NS6C6Nfd+eSr3mfMlPB31Sfn7AgMBAAEC
gYA2+zeFTYzxbvZtugE/c0CyXm7djSTpzLez4azzsqe6ji1VuAGYdJj/0KZ92Ab4
wOvc1r5PaSpO17t2exXqieNrF+GTM2t0e8IjjuI65wcWLtmmorSgxOaix2Ytww9m
7VSvjjkjMSXFKssmhrnnHwu5+Bi74xoQRQf/G9k3OsSZoQJBAOgfSqVwZGnaU6yi
bAQwW900XT7gDLr7gXQWzAGdvSIUYh2Elrr+rcXrlZ+xPRbsTTLIlmtmeqo9kCwe
d7B2fpECQQCE0MWQgBZHrfePHta7zU7XGTZBUljhMVVOldTEALVVhTBBn6kA62V8
iKOudmJX9AtPe6aITBzKK+qcTI1UIk3LAkEAt9mxAgBXSBAJHj83VsoGuNn00Qwc
iS0Th6NWyiDp4MhMPhz6VfnKIW1LAUUcob9gFc0SdtagaZ6BRrCLFFWGQQJAD1fa
6vWRHVjAl50Va36tU/YKqYMs118OntR6TuZSDH4lc/9Q09Vd1QQn/JiahdSgld8P
/wDj9osaQFIrpYOM/wJAWW38Ogcp70SPtAyV1kl4jP38jyXFD+M3VESBrhZRzz5E
F4RzDtfTdh+Oy9rr11Fr9HvlTQeNhBTTOc4veOpd3A==
-----END RSA PRIVATE KEY-----`,
      signOptions: { algorithm: 'HS256' },
    });
  }

  private log(event: string, payload: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        scope: 'local-user-vendor-service',
        event,
        ...payload,
      }),
    );
  }

  async createUser(raw: unknown): Promise<LegacyResponse> {
    try {
      const request = this.extractUser(raw);
      if (!request) {
        return legacyError('ERROR: Something went wrong', 500);
      }
      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const isUnique = await this.isUserUnique(request.username, request.email);
      if (!isUnique) {
        return legacyError('ERROR: Something went wrong', 500);
      }

      const userId = await this.generateUniqueNumericUserId();
      const now = new Date();
      const passwordHash = await this.encryptPassword(request.password);

      await this.prisma.user.create({
        data: {
          id: userId,
          name: request.name,
          username: request.username,
          email: request.email,
          phone: request.phone,
          whatsapp: request.whatsapp,
          location: request.location,
          blocked: false,
          attemptedLogin: 0,
          password: passwordHash,
          profileImage: '',
          dateCreated: now,
          deleted: false,
          verified: true,
          verificationCode: null,
        },
      });

      await this.prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)',
        userId,
        1,
      );

      await this.prisma.vendor.create({
        data: {
          id: userId,
          dateCreated: now,
          deleted: false,
          accountExists: false,
          initialised: false,
          profilePicture: '',
          accountName: `new vendor ${userId.toString()}`,
          biography: '',
          contact: '{"phone_number":"","email":"","whatsapp":""}',
        },
      });

      await this.sendRegistrationEmail(request.email, request.password);
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
        return legacyError(
          'Could not login user. Please check your credentials.',
          500,
        );
      }

      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
          deleted: false,
          blocked: false,
        },
      });

      if (!user) {
        this.log('login.user_not_found', {
          usernameOrEmail,
        });
        return legacyError(
          'Could not login user. Please check your credentials.',
          500,
        );
      }

      const verification = await this.verifyPasswordWithLegacyFallbacks(
        password,
        user.password,
      );
      if (!verification.ok) {
        this.log('login.password_mismatch', {
          userId: String(user.id),
          username: user.username,
          strategyTried: verification.strategy,
        });
        return legacyError(
          'Could not login user. Please check your credentials.',
          500,
        );
      }
      this.log('login.password_verified', {
        userId: String(user.id),
        username: user.username,
        strategy: verification.strategy,
      });

      const jwt = await this.jwtService.signAsync({
        iat: Math.floor(Date.now() / 1000),
        iss: this.resetIssuer,
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        userId: String(user.id),
        roles: [user.username === 'rei' ? 'ADMIN' : 'USER'],
        name: user.name,
        email: user.email,
        username: user.username,
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
      console.error(
        JSON.stringify({
          scope: 'local-user-vendor-service',
          event: 'login.exception',
          message,
          stack,
        }),
      );
      return legacyError(
        'Could not login user. Please check your credentials.',
        500,
      );
    }
  }

  private async verifyPasswordWithLegacyFallbacks(
    plainPassword: string,
    storedPassword: string,
  ): Promise<{ ok: boolean; strategy: string }> {
    // Legacy crypt($6$...) compatibility.
    try {
      const unixcrypt = await import('unixcrypt');
      const hashedInput = unixcrypt.encrypt(plainPassword, storedPassword);
      if (hashedInput === storedPassword) {
        return { ok: true, strategy: 'unixcrypt' };
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
        const bcrypt = await import('bcrypt');
        const normalizedHash = storedPassword.startsWith('$2y$')
          ? `$2b$${storedPassword.slice(4)}`
          : storedPassword;
        const ok = await bcrypt.compare(plainPassword, normalizedHash);
        if (ok) {
          return { ok: true, strategy: 'bcrypt' };
        }
      } catch {
        // Continue to next strategy.
      }
    }

    return { ok: false, strategy: 'all_failed' };
  }

  async resetPassword(raw: unknown): Promise<LegacyResponse> {
    try {
      const email = this.extractEmail(raw);
      if (!email) {
        return legacyError('Email is required', 500);
      }

      const user = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true, email: true },
      });
      if (!user) {
        return legacyError('Failed to reset password', 500);
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

      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: verificationToken },
      });

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

      const user = await this.prisma.user.findFirst({ where: { email } });
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
        return legacyError('Password could not be reset', 500);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: await this.encryptPassword(newPassword),
          verificationCode: null,
          dateUpdated: new Date(),
        },
      });

      return legacySuccess(true);
    } catch {
      return legacyError('Could not create user', 500);
    }
  }

  async updateUser(userId: string, rawUser: unknown): Promise<LegacyResponse> {
    try {
      const request = this.extractUser({ user: rawUser });
      if (!request) {
        return legacyError('Could not update user.', 500);
      }

      if (request.id && String(request.id) !== String(userId)) {
        return legacyError('Could not update user.', 500);
      }
      request.id = String(userId);

      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return legacyError('Could not update user.', 500);
      }

      const isUnique = await this.isUsernameAndEmailUnique(
        request.username,
        request.email,
        request.id,
      );
      if (!isUnique) {
        return legacyError('Could not update user.', 500);
      }

      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          name: request.name,
          username: request.username,
          email: request.email,
          phone: request.phone,
          whatsapp: request.whatsapp,
          location: request.location,
          dateUpdated: new Date(),
        },
      });

      await this.prisma.$executeRawUnsafe(
        'DELETE FROM user_role WHERE user_id = ?',
        BigInt(userId),
      );
      await this.prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)',
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
        return legacyError('Could not update user.', 500);
      }

      if (request.id && String(request.id) !== String(userId)) {
        return legacyError('Could not update user.', 500);
      }

      const validityError = this.validateCreateOrUpdateRequest(request);
      if (validityError) {
        return legacyError('Could not update user.', 500);
      }

      if (!request.password || request.password !== request.rewritePassword) {
        return legacyError('Could not update user.', 500);
      }

      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          password: await this.encryptPassword(request.password),
          dateUpdated: new Date(),
        },
      });

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
      return legacyError('Provided password were not the same.', 500);
    }
    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      return legacyError('No role was provided for the user', 500);
    }
    return null;
  }

  private async isUserUnique(
    username: string,
    email: string,
  ): Promise<boolean> {
    if (!username) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ username: email }, { email }],
        },
      });
      return !user;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });
    return !user;
  }

  private async isUsernameAndEmailUnique(
    username: string,
    email: string,
    id: string,
  ): Promise<boolean> {
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [{ username }, { email }],
      },
      select: { id: true },
    });

    if (rows.length === 0) return true;
    if (rows.length > 1) return false;
    return String(rows[0].id) === String(id);
  }

  private async generateUniqueNumericUserId(): Promise<bigint> {
    for (let i = 0; i < 100; i += 1) {
      const candidate = BigInt(this.generateRandomCode(15, true));
      const existing = await this.prisma.user.findUnique({
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
    const unixcrypt = await import('unixcrypt');
    return unixcrypt.encrypt(password, '$6$');
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
}
