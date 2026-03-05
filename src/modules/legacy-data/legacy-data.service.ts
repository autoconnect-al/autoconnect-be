import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';

@Injectable()
export class LegacyDataService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly platformHosts = this.resolvePlatformHosts();

  async makes(type = 'car') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ Make: string | null }>
    >(
      'SELECT DISTINCT Make FROM car_make_model WHERE type = ? ORDER BY Make ASC',
      type,
    );
    return legacySuccess(rows.map((row) => row.Make).filter(Boolean));
  }

  async models(make: string, type = 'car', full = false) {
    const cleanedMake =
      type === 'car' &&
      make.toLowerCase() !== 'mercedes-benz' &&
      make.toLowerCase() !== 'rolls-royce' &&
      make.toLowerCase() !== 'harley-davidson'
        ? make.replace(/(?<! )-(?! )/g, ' ')
        : make;
    if (full) {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ Model: string | null; isVariant: number | boolean | null }>
      >(
        'SELECT DISTINCT Model, isVariant FROM car_make_model WHERE type = ? AND Make = ? ORDER BY Model ASC',
        type,
        cleanedMake,
      );
      return legacySuccess(
        rows
          .filter((row) => !!row.Model)
          .map((row) => ({
            model: row.Model,
            isVariant: Number(row.isVariant ?? 0),
          })),
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ Model: string | null }>
    >(
      'SELECT DISTINCT Model FROM car_make_model WHERE type = ? AND Make = ? ORDER BY Model ASC',
      type,
      cleanedMake,
    );
    return legacySuccess(rows.map((row) => row.Model).filter(Boolean));
  }

  async resolveVendor(host?: string, username?: string) {
    const normalizedHost = this.normalizeHost(host);
    const normalizedUsername = this.normalizeUsername(username);

    if (normalizedHost) {
      const customDomainCandidates = this.getCustomDomainCandidates(normalizedHost);
      const byCustomDomain = await this.resolveByCustomDomain(customDomainCandidates);
      if (byCustomDomain) {
        return legacySuccess(this.normalizeBigInts(byCustomDomain));
      }

      const subdomain = this.extractSubdomain(normalizedHost);
      if (subdomain) {
        const bySubdomain = await this.resolveBySubdomain(subdomain);
        if (bySubdomain) {
          return legacySuccess(this.normalizeBigInts(bySubdomain));
        }
      }
    }

    if (normalizedUsername) {
      const usernameCandidates = this.getUsernameCandidates(normalizedUsername);
      const byUsername = await this.resolveByUsername(usernameCandidates);
      if (byUsername) {
        return legacySuccess(this.normalizeBigInts(byUsername));
      }
    }

    return legacySuccess(null);
  }

  async vendor(name: string) {
    const cleanedName = name.replace(/-/g, '.');
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      'SELECT * FROM vendor WHERE accountName = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
      cleanedName,
    );
    return legacySuccess(this.normalizeBigInts(rows[0] ?? null));
  }

  async vendorBiography(name: string) {
    const cleanedName = name.replace(/-/g, '.');
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ biography: string | null; profilePicture: string | null }>
    >(
      'SELECT biography, profilePicture FROM vendor WHERE accountName = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
      cleanedName,
    );
    if (!rows[0]) return legacySuccess(null);
    return legacySuccess({
      biography: this.normalizeBiography(rows[0].biography ?? ''),
      profilePicture: rows[0].profilePicture,
    });
  }

  async article(lang: string, id: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      'SELECT * FROM article WHERE id = ? AND appName = ? AND deleted = 0 LIMIT 1',
      id,
      app,
    );
    if (!rows[0]) {
      return {
        success: true,
        message: '',
        statusCode: '200',
      };
    }
    return legacySuccess(this.applyLanguageToArticle(rows[0], lang));
  }

  async articles(
    lang: string,
    category: string,
    page = 0,
    app = 'autoconnect',
  ) {
    const offset = Math.max(page, 0) * 9;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      'SELECT * FROM article WHERE category = ? AND appName = ? AND deleted = 0 ORDER BY dateCreated DESC LIMIT 9 OFFSET ?',
      category,
      app,
      offset,
    );
    return legacySuccess(rows.map((row) => this.applyLanguageToArticle(row, lang)));
  }

  async articlesTotal(lang: string, category: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint | number }>
    >(
      'SELECT COUNT(*) as total FROM article WHERE category = ? AND appName = ? AND deleted = 0',
      category,
      app,
    );
    return legacySuccess(Math.ceil(Number(rows[0]?.total ?? 0) / 9));
  }

  async latestArticles(lang: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        category: string;
        data: string | null;
        image: string | null;
        dateCreated: Date | string;
      }>
    >(
      `SELECT a.id, a.category, a.data, a.image, a.dateCreated
       FROM article a
       WHERE a.deleted = 0
         AND a.appName = ?
         AND a.id = (
           SELECT a2.id
           FROM article a2
           WHERE a2.deleted = 0
             AND a2.appName = a.appName
             AND a2.category = a.category
           ORDER BY a2.dateCreated DESC, a2.id DESC
           LIMIT 1
         )
       ORDER BY a.dateCreated DESC, a.id DESC
       LIMIT 5`,
      app,
    );
    const mapped = rows.map((row) => ({
      ...row,
      data: this.filterArticleDataByLanguage(row.data, lang),
    }));
    return legacySuccess(mapped);
  }

  async relatedArticles(
    lang: string,
    category: string,
    app = 'autoconnect',
    excludeId?: string,
  ) {
    const excludeClause = excludeId ? 'AND id <> ?' : '';
    const query = `SELECT * FROM article WHERE category = ? AND appName = ? AND deleted = 0 ${excludeClause} ORDER BY dateCreated DESC LIMIT 3`;
    const rows = excludeId
      ? await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          query,
          category,
          app,
          excludeId,
        )
      : await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          query,
          category,
          app,
        );
    return legacySuccess(rows.map((row) => this.applyLanguageToArticle(row, lang)));
  }

  async metadata(lang: string, id: string, app = 'autoconnect') {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        image: string | null;
        category: string;
      }>
    >(
      'SELECT id, title, image, category FROM article WHERE id = ? AND appName = ? AND deleted = 0 LIMIT 1',
      id,
      app,
    );
    if (!rows[0]) {
      return {
        success: true,
        message: '',
        statusCode: '200',
      };
    }
    return legacySuccess(rows[0]);
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }

  private filterArticleDataByLanguage(
    data: string | null,
    lang: string,
  ): string {
    if (!data) return JSON.stringify([]);
    try {
      const parsed = JSON.parse(data) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) return JSON.stringify([]);
      const filtered = parsed.filter(
        (item) => String(item?.language ?? '') === lang,
      );
      return JSON.stringify(filtered);
    } catch {
      return JSON.stringify([]);
    }
  }

  private normalizeBiography(input: string): string {
    return input
      .replace(/ ,/g, ',')
      .replace(/ !/g, '! ')
      .replace(/ - /g, '-')
      .replace(/ : /g, ':')
      .replace(/: /g, ':')
      .replace(/ :/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private applyLanguageToArticle(
    row: Record<string, unknown>,
    lang: string,
  ): Record<string, unknown> {
    if (!row || typeof row !== 'object') return row;
    const data = typeof row.data === 'string' ? row.data : null;
    return {
      ...row,
      data: this.filterArticleDataByLanguage(data, lang),
    };
  }

  private resolvePlatformHosts(): string[] {
    const envValues = [
      process.env.BASE_URL,
      process.env.ALLOWED_ORIGIN,
      process.env.AUTOCONNECT_BASE_URL,
    ].filter(Boolean) as string[];

    const hosts = new Set<string>(['autoconnect.al', 'www.autoconnect.al']);

    for (const rawValue of envValues) {
      const normalized = this.normalizeHost(rawValue);
      if (normalized) {
        hosts.add(normalized);
      }
    }

    return Array.from(hosts);
  }

  private normalizeHost(host?: string): string | null {
    const raw = String(host ?? '').trim().toLowerCase();
    if (!raw) return null;

    const withProtocol =
      raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `http://${raw}`;

    try {
      return new URL(withProtocol).hostname.replace(/\.$/, '');
    } catch {
      return raw
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .split(':')[0]
        .replace(/\.$/, '');
    }
  }

  private normalizeUsername(username?: string): string | null {
    const raw = String(username ?? '').trim();
    if (!raw) return null;

    try {
      return decodeURIComponent(raw).toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
  }

  private getCustomDomainCandidates(host: string): string[] {
    const candidates = [host];
    if (host.startsWith('www.')) {
      candidates.push(host.slice(4));
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  private getUsernameCandidates(username: string): string[] {
    const hyphenToDot = username.replace(/-/g, '.');
    return Array.from(new Set([username, hyphenToDot].filter(Boolean)));
  }

  private isPlatformSubdomainHost(host: string): boolean {
    if (host.endsWith('.localhost')) return true;

    return this.platformHosts.some(
      (platformHost) =>
        host === platformHost || host.endsWith(`.${platformHost}`),
    );
  }

  private extractSubdomain(host: string): string | null {
    if (!this.isPlatformSubdomainHost(host)) {
      return null;
    }

    const parts = host.split('.').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts.length === 2 && parts[1] !== 'localhost') return null;

    const candidate = parts[0];
    if (candidate === 'www') return null;
    return candidate;
  }

  private async resolveByCustomDomain(candidates: string[]) {
    for (const candidate of candidates) {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM vendor WHERE LOWER(customDomain) = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
        candidate,
      );
      if (rows[0]) return rows[0];
    }
    return null;
  }

  private async resolveBySubdomain(subdomain: string) {
    const candidates = this.getSubdomainCandidates(subdomain);

    for (const candidate of candidates) {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM vendor WHERE LOWER(subdomain) = ? AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
        candidate,
      );
      if (rows[0]) return rows[0];
    }

    return null;
  }

  private async resolveByUsername(candidates: string[]) {
    for (const candidate of candidates) {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM vendor WHERE (LOWER(username) = ? OR LOWER(accountName) = ?) AND deleted = 0 AND initialised = 1 AND accountExists = 1 LIMIT 1',
        candidate,
        candidate,
      );
      if (rows[0]) return rows[0];
    }

    return null;
  }

  private getSubdomainCandidates(subdomain: string): string[] {
    const normalized = subdomain.trim().toLowerCase();
    const candidates = [normalized];

    // Acceptance/staging convention: <slug>-dev.autoconnect.al
    if (normalized.endsWith('-dev') && normalized.length > 4) {
      candidates.push(normalized.slice(0, -4));
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }
}
