import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { normalizeVendorSiteConfigInput } from '../legacy-group-a/vendor-site-config.util';

type AnyRecord = Record<string, unknown>;
type SiteSettingsTarget = 'dev' | 'prod';
type VendorPrismaClient = Pick<PrismaClient, 'vendor'>;

type ParsedTargetResult =
  | { ok: true; value: SiteSettingsTarget }
  | { ok: false; error: string };

type OptionalStringResult =
  | { ok: true; value: string | null | undefined }
  | { ok: false; error: string };

const SITE_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const SITE_SETTINGS_FIELDS_SELECT = {
  id: true,
  siteEnabled: true,
  subdomain: true,
  customDomain: true,
  theme: true,
  primaryColor: true,
  secondaryColor: true,
  logo: true,
  banner: true,
  siteConfig: true,
} as const;

@Injectable()
export class ApVendorManagementService implements OnModuleDestroy {
  private devPrismaClient: PrismaClient | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    if (this.devPrismaClient) {
      await this.devPrismaClient.$disconnect();
      this.devPrismaClient = null;
    }
  }

  async getVendors() {
    const rows = await this.prisma.vendor.findMany({
      orderBy: [{ deleted: 'asc' }, { dateUpdated: 'asc' }],
      take: 1000,
    });
    return legacySuccess(rows.map((row) => this.normalizeBigInts(row)));
  }

  async addVendor(id: string) {
    const vendorId = BigInt(id);
    const existing = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!existing) {
      await this.prisma.vendor.create({
        data: {
          id: vendorId,
          dateCreated: new Date(),
          deleted: false,
          accountExists: false,
          initialised: false,
          profilePicture: '',
          accountName: `new vendor ${id}`,
          biography: '',
          contact: '{"phone_number": "", "email": "", "whatsapp": ""}',
        },
      });
    }
    return legacySuccess(null, 'Vendor added successfully');
  }

  async addVendorDetails(id: string, rawBody: unknown) {
    const payload = (rawBody ?? {}) as AnyRecord;
    const account = this.parseJsonObject(payload.account);

    const updates: Record<string, unknown> = {
      accountExists: true,
      dateUpdated: new Date(),
    };

    if (account) {
      const username = this.toSafeString(account.username);
      if (username) updates.accountName = username;
      const profilePicUrl = this.toSafeString(account.profilePicUrl);
      if (profilePicUrl) updates.profilePicture = profilePicUrl;
    }

    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: updates,
    });

    return legacySuccess(null, 'Vendor added successfully');
  }

  async editVendor(id: string, rawVendor: unknown) {
    const vendor = this.extractVendor(rawVendor);
    const values: Record<string, unknown> = {
      dateUpdated: new Date(),
    };

    if (vendor.accountName) values.accountName = vendor.accountName;
    if (vendor.biography) values.biography = vendor.biography;
    if (vendor.contact) values.contact = JSON.stringify(vendor.contact);
    if (vendor.profilePicture) values.profilePicture = vendor.profilePicture;

    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: values,
    });
    return legacySuccess(null, 'Vendor updated successfully');
  }

  async getNextVendorToCrawl() {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        deleted: false,
        accountExists: true,
      },
      orderBy: [{ dateUpdated: 'asc' }, { dateCreated: 'asc' }],
    });
    return legacySuccess(this.normalizeBigInts(vendor));
  }

  async markVendorForCrawlNext(id: string) {
    await this.prisma.vendor.update({
      where: { id: BigInt(id) },
      data: { dateUpdated: null },
    });
    return legacySuccess(null, 'Vendor marked for crawl next');
  }

  async toggleVendorDeleted(id: string) {
    const vendorId = BigInt(id);
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) return legacyError('Could not mark vendor for crawl next');

    const deleted = !vendor.deleted;
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deleted,
        dateUpdated: new Date(),
      },
    });

    const vendorPosts = await this.prisma.post.findMany({
      where: { vendor_id: vendorId },
      select: { id: true },
    });
    const postIds = vendorPosts.map((item) => item.id);

    await this.prisma.post.updateMany({
      where: { vendor_id: vendorId },
      data: { deleted, dateUpdated: new Date() },
    });
    if (postIds.length > 0) {
      await this.prisma.car_detail.updateMany({
        where: { post_id: { in: postIds } },
        data: { deleted, dateUpdated: new Date() },
      });
    }

    return legacySuccess(null, 'Vendor marked for crawl next');
  }

  async getVendorSiteSettings(id: string, rawTarget?: string) {
    const target = this.parseSiteSettingsTarget(rawTarget);
    if (!target.ok) {
      return legacyError(target.error, 400);
    }

    const targetClient = this.resolveTargetClient(target.value);
    if (!targetClient.ok) {
      return legacyError(targetClient.error, 500);
    }

    const vendor = await targetClient.client.vendor.findUnique({
      where: { id: BigInt(id) },
      select: SITE_SETTINGS_FIELDS_SELECT,
    });

    if (!vendor) {
      return legacyError('Vendor not found', 404);
    }

    return legacySuccess({
      id: String(vendor.id),
      target: target.value,
      siteEnabled: Boolean(vendor.siteEnabled),
      subdomain: vendor.subdomain ?? null,
      customDomain: vendor.customDomain ?? null,
      theme: vendor.theme ?? null,
      primaryColor: vendor.primaryColor ?? null,
      secondaryColor: vendor.secondaryColor ?? null,
      logo: vendor.logo ?? null,
      banner: vendor.banner ?? null,
      siteConfig: this.parseSiteConfig(vendor.siteConfig),
    });
  }

  async updateVendorSiteSettings(id: string, rawTarget: string | undefined, rawBody: unknown) {
    const target = this.parseSiteSettingsTarget(rawTarget);
    if (!target.ok) {
      return legacyError(target.error, 400);
    }

    const targetClient = this.resolveTargetClient(target.value);
    if (!targetClient.ok) {
      return legacyError(targetClient.error, 500);
    }

    const payload = this.extractSiteSettingsPayload(rawBody);
    if (!payload) {
      return legacyError('Invalid site settings payload', 400);
    }

    const vendorId = BigInt(id);
    const vendorExists = await targetClient.client.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });

    if (!vendorExists) {
      return legacyError('Vendor not found', 404);
    }

    const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
    const updateData: Prisma.vendorUpdateInput = {
      dateUpdated: new Date(),
    };

    if (has('siteEnabled')) {
      if (typeof payload.siteEnabled !== 'boolean') {
        return legacyError('siteEnabled must be a boolean', 400);
      }
      updateData.siteEnabled = payload.siteEnabled;
    }

    if (has('subdomain')) {
      const normalizedSubdomain = this.normalizeSubdomain(payload.subdomain);
      if (!normalizedSubdomain.ok) {
        return legacyError(normalizedSubdomain.error, 400);
      }
      updateData.subdomain = normalizedSubdomain.value;
    }

    if (has('customDomain')) {
      const normalizedCustomDomain = this.normalizeCustomDomain(payload.customDomain);
      if (!normalizedCustomDomain.ok) {
        return legacyError(normalizedCustomDomain.error, 400);
      }
      updateData.customDomain = normalizedCustomDomain.value;
    }

    if (has('theme')) {
      const normalizedTheme = this.normalizeStringField(payload.theme, 'theme', 50);
      if (!normalizedTheme.ok) {
        return legacyError(normalizedTheme.error, 400);
      }
      updateData.theme = normalizedTheme.value;
    }

    if (has('primaryColor')) {
      const normalizedPrimaryColor = this.normalizeHexColor(payload.primaryColor, 'primaryColor');
      if (!normalizedPrimaryColor.ok) {
        return legacyError(normalizedPrimaryColor.error, 400);
      }
      updateData.primaryColor = normalizedPrimaryColor.value;
    }

    if (has('secondaryColor')) {
      const normalizedSecondaryColor = this.normalizeHexColor(payload.secondaryColor, 'secondaryColor');
      if (!normalizedSecondaryColor.ok) {
        return legacyError(normalizedSecondaryColor.error, 400);
      }
      updateData.secondaryColor = normalizedSecondaryColor.value;
    }

    if (has('logo')) {
      const normalizedLogo = this.normalizeStringField(payload.logo, 'logo', 255);
      if (!normalizedLogo.ok) {
        return legacyError(normalizedLogo.error, 400);
      }
      updateData.logo = normalizedLogo.value;
    }

    if (has('banner')) {
      const normalizedBanner = this.normalizeStringField(payload.banner, 'banner', 255);
      if (!normalizedBanner.ok) {
        return legacyError(normalizedBanner.error, 400);
      }
      updateData.banner = normalizedBanner.value;
    }

    if (has('siteConfig')) {
      const normalizedSiteConfig = normalizeVendorSiteConfigInput(payload.siteConfig);
      if (!normalizedSiteConfig.ok) {
        return legacyError(`Invalid site config payload: ${normalizedSiteConfig.error}`, 400);
      }

      updateData.siteConfig =
        normalizedSiteConfig.value === null
          ? null
          : JSON.stringify(normalizedSiteConfig.value);
    }

    const hasSiteFieldUpdate = [
      'siteEnabled',
      'subdomain',
      'customDomain',
      'theme',
      'primaryColor',
      'secondaryColor',
      'logo',
      'banner',
      'siteConfig',
    ].some((key) => has(key));

    if (!hasSiteFieldUpdate) {
      return legacyError('No site settings fields to update', 400);
    }

    const subdomain =
      typeof updateData.subdomain === 'string' ? updateData.subdomain : null;
    const customDomain =
      typeof updateData.customDomain === 'string' ? updateData.customDomain : null;

    const uniquenessError = await this.ensureUniqueDomainFields(
      targetClient.client,
      vendorId,
      subdomain,
      customDomain,
    );
    if (uniquenessError) {
      return legacyError(uniquenessError, 409);
    }

    await targetClient.client.vendor.update({
      where: { id: vendorId },
      data: updateData,
    });

    return legacySuccess(null, 'Vendor site settings updated successfully');
  }

  async publishVendorSiteSettings(id: string) {
    const devClient = this.resolveTargetClient('dev');
    if (!devClient.ok) {
      return legacyError(devClient.error, 500);
    }

    const vendorId = BigInt(id);
    const sourceVendor = await devClient.client.vendor.findUnique({
      where: { id: vendorId },
      select: SITE_SETTINGS_FIELDS_SELECT,
    });

    if (!sourceVendor) {
      return legacyError('Vendor not found in dev database', 404);
    }

    const targetVendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!targetVendor) {
      return legacyError('Vendor not found in prod database', 404);
    }

    const uniquenessError = await this.ensureUniqueDomainFields(
      this.prisma,
      vendorId,
      sourceVendor.subdomain,
      sourceVendor.customDomain,
    );
    if (uniquenessError) {
      return legacyError(uniquenessError, 409);
    }

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        dateUpdated: new Date(),
        siteEnabled: Boolean(sourceVendor.siteEnabled),
        subdomain: sourceVendor.subdomain,
        customDomain: sourceVendor.customDomain,
        theme: sourceVendor.theme,
        primaryColor: sourceVendor.primaryColor,
        secondaryColor: sourceVendor.secondaryColor,
        logo: sourceVendor.logo,
        banner: sourceVendor.banner,
        siteConfig: sourceVendor.siteConfig,
      },
    });

    return legacySuccess(null, 'Vendor site settings published to prod');
  }

  private extractVendor(rawVendor: unknown): {
    accountName: string;
    biography: string;
    profilePicture: string;
    contact: AnyRecord | null;
  } {
    const root = this.toObject(rawVendor);
    const source = root.vendor ?? root;
    const vendor =
      typeof source === 'string'
        ? (this.parseJsonObject(source) ?? {})
        : (source as AnyRecord);

    return {
      accountName: this.toSafeString(vendor.accountName),
      biography: this.toSafeString(vendor.biography),
      profilePicture: this.toSafeString(vendor.profilePicture),
      contact:
        vendor.contact && typeof vendor.contact === 'object'
          ? (vendor.contact as AnyRecord)
          : this.parseJsonObject(vendor.contact),
    };
  }

  private extractSiteSettingsPayload(rawBody: unknown): AnyRecord | null {
    const root = this.toObject(rawBody);
    const source = root.siteSettings ?? root.vendor ?? root;

    if (typeof source === 'string') {
      return this.parseJsonObject(source);
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return null;
    }

    return source as AnyRecord;
  }

  private parseJsonObject(value: unknown): AnyRecord | null {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as AnyRecord;
    }
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as AnyRecord)
        : null;
    } catch {
      return null;
    }
  }

  private toObject(value: unknown): AnyRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as AnyRecord;
  }

  private toSafeString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  private normalizeStringField(
    value: unknown,
    field: string,
    maxLength: number,
  ): OptionalStringResult {
    if (value === undefined) {
      return { ok: true, value: undefined };
    }

    if (value === null || value === '') {
      return { ok: true, value: null };
    }

    if (typeof value !== 'string') {
      return { ok: false, error: `${field} must be a string` };
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }

    if (trimmed.length > maxLength) {
      return {
        ok: false,
        error: `${field} must not exceed ${maxLength} characters`,
      };
    }

    return { ok: true, value: trimmed };
  }

  private normalizeHexColor(value: unknown, field: string): OptionalStringResult {
    const normalized = this.normalizeStringField(value, field, 7);
    if (!normalized.ok || normalized.value === undefined || normalized.value === null) {
      return normalized;
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(normalized.value)) {
      return { ok: false, error: `${field} must be a 6-digit hex color` };
    }

    return { ok: true, value: normalized.value };
  }

  private normalizeSubdomain(value: unknown): OptionalStringResult {
    const normalized = this.normalizeStringField(value, 'subdomain', 63);
    if (!normalized.ok || normalized.value === undefined || normalized.value === null) {
      return normalized;
    }

    const candidate = normalized.value.toLowerCase();
    if (!SITE_SUBDOMAIN_REGEX.test(candidate)) {
      return {
        ok: false,
        error:
          'subdomain must be lowercase alphanumeric with optional internal hyphen and length 3..63',
      };
    }

    return { ok: true, value: candidate };
  }

  private normalizeCustomDomain(value: unknown): OptionalStringResult {
    const normalized = this.normalizeStringField(value, 'customDomain', 255);
    if (!normalized.ok || normalized.value === undefined || normalized.value === null) {
      return normalized;
    }

    const candidate = normalized.value.toLowerCase();

    if (/^https?:\/\//i.test(candidate)) {
      return {
        ok: false,
        error: 'customDomain must not include protocol',
      };
    }

    if (
      candidate.includes('/')
      || candidate.includes('?')
      || candidate.includes('#')
      || candidate.includes(':')
    ) {
      return {
        ok: false,
        error: 'customDomain must be a host only (no path, query, hash, or port)',
      };
    }

    if (!/^[a-z0-9.-]+$/.test(candidate)) {
      return {
        ok: false,
        error: 'customDomain contains invalid characters',
      };
    }

    if (
      candidate.startsWith('.')
      || candidate.endsWith('.')
      || candidate.includes('..')
      || !candidate.includes('.')
    ) {
      return {
        ok: false,
        error: 'customDomain must be a valid hostname',
      };
    }

    return { ok: true, value: candidate };
  }

  private parseSiteSettingsTarget(rawTarget?: string): ParsedTargetResult {
    if (rawTarget === undefined || rawTarget === null || rawTarget.trim() === '') {
      return { ok: true, value: 'prod' };
    }

    const normalized = rawTarget.trim().toLowerCase();
    if (normalized !== 'dev' && normalized !== 'prod') {
      return { ok: false, error: 'target must be dev or prod' };
    }

    return { ok: true, value: normalized as SiteSettingsTarget };
  }

  private resolveTargetClient(
    target: SiteSettingsTarget,
  ): { ok: true; client: VendorPrismaClient } | { ok: false; error: string } {
    if (target === 'prod') {
      return { ok: true, client: this.prisma };
    }

    const devClient = this.getOrCreateDevPrismaClient();
    if (!devClient) {
      return {
        ok: false,
        error: 'AP_DEV_DATABASE_URL is missing; dev target is unavailable',
      };
    }

    return { ok: true, client: devClient };
  }

  private getOrCreateDevPrismaClient(): PrismaClient | null {
    if (this.devPrismaClient) {
      return this.devPrismaClient;
    }

    const databaseUrl = process.env.AP_DEV_DATABASE_URL?.trim();
    if (!databaseUrl) {
      return null;
    }

    this.devPrismaClient = new PrismaClient({
      adapter: new PrismaMariaDb(databaseUrl),
    });

    return this.devPrismaClient;
  }

  private async ensureUniqueDomainFields(
    client: VendorPrismaClient,
    vendorId: bigint,
    subdomain: string | null,
    customDomain: string | null,
  ): Promise<string | null> {
    if (subdomain) {
      const conflictingSubdomain = await client.vendor.findFirst({
        where: {
          subdomain,
          NOT: { id: vendorId },
        },
        select: { id: true },
      });
      if (conflictingSubdomain) {
        return 'subdomain is already in use';
      }
    }

    if (customDomain) {
      const conflictingDomain = await client.vendor.findFirst({
        where: {
          customDomain,
          NOT: { id: vendorId },
        },
        select: { id: true },
      });
      if (conflictingDomain) {
        return 'customDomain is already in use';
      }
    }

    return null;
  }

  private parseSiteConfig(siteConfig: string | null): AnyRecord | null {
    if (!siteConfig) {
      return null;
    }

    try {
      const parsed = JSON.parse(siteConfig) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed as AnyRecord;
    } catch {
      return null;
    }
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
