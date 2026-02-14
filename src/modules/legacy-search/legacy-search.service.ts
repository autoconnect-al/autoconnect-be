import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';

type FilterTerm = {
  key: string;
  value: unknown;
};

type SearchFilter = {
  type?: string;
  keyword?: string;
  generalSearch?: string;
  searchTerms?: FilterTerm[];
  sortTerms?: Array<{ key?: string; order?: string }>;
  page?: number | string;
  maxResults?: number | string;
};

@Injectable()
export class LegacySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(filterRaw: string | undefined) {
    const filter = this.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while searching for cars', 500);
    }
    const { whereSql, params } = this.buildWhere(filter);
    const { orderSql, limit, offset } = this.buildSortAndPagination(filter);
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM search ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    );
    return legacySuccess(this.normalizeBigInts(rows));
  }

  async countResults(filterRaw: string | undefined) {
    const filter = this.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while counting results', 500);
    }
    const { whereSql, params } = this.buildWhere(filter);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint | number }>
    >(`SELECT COUNT(*) as total FROM search ${whereSql}`, ...params);
    const count = Number(rows[0]?.total ?? 0);
    return legacySuccess(count);
  }

  async priceCalculate(filterRaw: string | undefined) {
    const filter = this.parseFilter(filterRaw);
    if (!filter) {
      return legacyError('An error occurred while searching for cars', 500);
    }

    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '');
    const registrationRaw = terms.get('registration');
    const fuelType = this.toStr(terms.get('fuelType') ?? '');
    const bodyType = this.toStr(terms.get('bodyType') ?? '');
    const transmission = this.toStr(terms.get('transmission') ?? '');

    const registrationFrom = this.extractRegistrationFrom(registrationRaw);
    if (!make || !model || !registrationFrom || !fuelType) {
      return legacySuccess([]);
    }

    const modelResolution = await this.resolveModel(make, model);

    const where: string[] = [
      'CAST(p.createdTime AS UNSIGNED) > ?',
      'cd.price > 0',
      'cd.make = ?',
      '(cd.customsPaid = 1 OR cd.customsPaid IS NULL)',
      'cd.registration >= ?',
      'cd.registration <= ?',
      'cd.fuelType = ?',
    ];
    const params: unknown[] = [
      Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60,
      make,
      String(registrationFrom - 2),
      String(registrationFrom + 2),
      fuelType,
    ];

    if (modelResolution.isVariant) {
      where.push('(cd.variant LIKE ? OR cd.variant LIKE ?)');
      params.push(
        `% ${modelResolution.variant} %`,
        `${modelResolution.model}%`,
      );
    } else {
      where.push('cd.model = ?');
      params.push(modelResolution.model.replace(' (all)', ''));
    }

    if (transmission) {
      where.push('cd.transmission = ?');
      params.push(transmission);
    }
    if (bodyType) {
      where.push('cd.bodyType = ?');
      params.push(bodyType);
    }

    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT cd.price, cd.make, cd.model, cd.variant, cd.registration, p.id
       FROM post p
       LEFT JOIN car_detail cd ON cd.post_id = p.id
       WHERE ${where.join(' AND ')}`,
      ...params,
    );

    return legacySuccess(this.normalizeBigInts(rows));
  }

  async mostWanted(excludeIds?: string, excludedAccounts?: string) {
    const excludeIdList = (excludeIds ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((id) => `'${id.replace(/'/g, "''")}'`)
      .join(',');

    const excludeAccountList = (excludedAccounts ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((name) => `'${name.replace(/'/g, "''")}'`)
      .join(',');

    const clauses: string[] = [
      'mostWantedTo IS NOT NULL',
      'mostWantedTo > UNIX_TIMESTAMP()',
    ];
    if (excludeIdList) {
      clauses.push(`id NOT IN (${excludeIdList})`);
    }
    if (excludeAccountList) {
      clauses.push(`accountName NOT IN (${excludeAccountList})`);
    }

    const query = `SELECT id, make, model, price, accountName FROM search WHERE ${clauses.join(' AND ')} ORDER BY mostWantedTo DESC LIMIT 24`;
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(query);
    return legacySuccess(this.normalizeBigInts(rows));
  }

  async getCarDetails(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      'SELECT * FROM search WHERE id = ? LIMIT 1',
      id,
    );
    if (rows.length === 0) {
      return legacyError('Car details not found', 404);
    }
    return legacySuccess(this.normalizeBigInts(rows));
  }

  async getCaption(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ cleanedCaption: string | null; sidecarMedias: unknown }>
    >(
      'SELECT cleanedCaption, sidecarMedias FROM search WHERE id = ? LIMIT 1',
      id,
    );
    if (rows.length === 0) {
      return legacyError('Car details not found', 404);
    }
    const first = rows[0] ?? { cleanedCaption: null, sidecarMedias: null };
    const cleanedCaption = this.normalizeCaption(first.cleanedCaption ?? '');
    const mediaUrl = await this.resolveCaptionMedia(first.sidecarMedias);
    return legacySuccess({ cleanedCaption, mediaUrl });
  }

  async relatedById(id: string, type = 'car', excludedIds?: string) {
    const row = await this.prisma.$queryRawUnsafe<
      Array<{ make: string | null; model: string | null }>
    >('SELECT make, model FROM search WHERE id = ? LIMIT 1', id);
    const make = row[0]?.make;
    const model = row[0]?.model;
    if (!make || !model) {
      return legacySuccess([]);
    }

    const excluded = (excludedIds ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((value) => `'${value.replace(/'/g, "''")}'`)
      .join(',');

    const excludedClause = excluded ? `AND id NOT IN (${excluded})` : '';
    const params: unknown[] = [make, model, id, type];
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, make, model, price FROM search WHERE make = ? AND model = ? AND id <> ? AND sold = 0 AND deleted = '0' AND type = ? ${excludedClause} ORDER BY dateUpdated DESC LIMIT 4`,
      ...params,
    );
    return legacySuccess(this.normalizeBigInts(rows));
  }

  async relatedByFilter(
    filterRaw: string | undefined,
    type = 'car',
    excludedIds?: string,
  ) {
    const filter = this.parseFilter(filterRaw);
    if (!filter) {
      return legacyError(
        'An error occurred while getting related searches',
        500,
      );
    }

    const terms = this.termMap(filter.searchTerms ?? []);
    const make = this.toStr(terms.get('make1') ?? '');
    const model = this.toStr(terms.get('model1') ?? '');
    const excluded = (excludedIds ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((value) => `'${value.replace(/'/g, "''")}'`)
      .join(',');
    const excludedClause = excluded ? `AND id NOT IN (${excluded})` : '';

    const params: unknown[] = [type];
    let where = `sold = 0 AND deleted = '0' AND type = ? ${excludedClause}`;
    if (make) {
      where += ' AND make = ?';
      params.push(make);
    }
    if (model) {
      where += ' AND model = ?';
      params.push(model.replace(' (all)', ''));
    }

    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, make, model, price FROM search WHERE ${where} ORDER BY dateUpdated DESC LIMIT 4`,
      ...params,
    );
    return legacySuccess(this.normalizeBigInts(rows));
  }

  private parseFilter(filterRaw: string | undefined): SearchFilter | null {
    if (!filterRaw || typeof filterRaw !== 'string') return null;
    try {
      const parsed = JSON.parse(filterRaw) as SearchFilter;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private extractRegistrationFrom(registrationRaw: unknown): number | null {
    if (!registrationRaw || typeof registrationRaw !== 'object') return null;
    const fromValue = (registrationRaw as Record<string, unknown>).from;
    const from = Number(this.toStr(fromValue));
    if (!Number.isFinite(from) || from <= 0) return null;
    return from;
  }

  private async resolveModel(
    make: string,
    model: string,
  ): Promise<{ model: string; variant: string; isVariant: boolean }> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ Model: string | null; isVariant: boolean | number | null }>
    >('SELECT Model, isVariant FROM car_make_model WHERE Make = ?', make);

    const normalizedInput = this.normalizeModelToken(model);
    for (const row of rows) {
      const dbModel = this.toStr(row.Model ?? '');
      if (!dbModel) continue;
      const normalizedDb = this.normalizeModelToken(dbModel);
      if (
        normalizedDb.includes(normalizedInput) &&
        normalizedInput.includes(normalizedDb)
      ) {
        return {
          model: dbModel,
          variant: dbModel,
          isVariant: Boolean(row.isVariant),
        };
      }
    }

    const fallback = model.replace(/-/g, ' ');
    return { model: fallback, variant: fallback, isVariant: false };
  }

  private normalizeModelToken(value: string): string {
    return value.replace(/\s+/g, '-').toLowerCase();
  }

  private normalizeCaption(caption: string): string {
    if (!caption) return '';
    return caption
      .replace(/ ,/g, ',')
      .replace(/ !/g, '!')
      .replace(/ - /g, '-')
      .replace(/ : /g, ':')
      .replace(/: /g, ':')
      .replace(/ :/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async resolveCaptionMedia(
    sidecarMedias: unknown,
  ): Promise<string | null> {
    const source = this.firstSidecarThumbnail(sidecarMedias);
    if (!source) return null;

    const jpg = this.toJpgUrlIfWebp(source);
    if (jpg !== source) {
      const exists = await this.urlExists(jpg);
      if (exists) return jpg;
    }
    return source;
  }

  private firstSidecarThumbnail(sidecarMedias: unknown): string | null {
    let parsed: unknown = sidecarMedias;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = (parsed as unknown[])[0];
    if (!first || typeof first !== 'object') return null;
    const candidate = (first as Record<string, unknown>).imageThumbnailUrl;
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate
      : null;
  }

  private toJpgUrlIfWebp(url: string): string {
    return url.replace(/\.webp(\?.*)?$/i, '.jpg$1');
  }

  private async urlExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildSortAndPagination(filter: SearchFilter) {
    const sort =
      Array.isArray(filter.sortTerms) && filter.sortTerms.length > 0
        ? filter.sortTerms[0]
        : {};
    const allowedSort = new Map([
      ['renewedTime', 'renewedTime'],
      ['price', 'price'],
      ['mileage', 'mileage'],
      ['registration', 'registration'],
    ]);
    const sortKey =
      allowedSort.get(String(sort?.key ?? 'renewedTime')) ?? 'renewedTime';
    const sortOrder =
      String(sort?.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const maxResults = Number(filter.maxResults ?? 24);
    const page = Number(filter.page ?? 0);
    const limit =
      Number.isFinite(maxResults) && maxResults > 0 ? maxResults : 24;
    const offset =
      Number.isFinite(page) && page > 0 ? Math.floor(page) * limit : 0;

    return {
      orderSql: `ORDER BY ${sortKey} ${sortOrder}`,
      limit,
      offset,
    };
  }

  private buildWhere(filter: SearchFilter) {
    const terms = this.termMap(filter.searchTerms ?? []);
    const clauses: string[] = [`sold = 0`, `deleted = '0'`];
    const params: unknown[] = [];
    const type = this.toStr(filter.type ?? '');
    clauses.push('type = ?');
    params.push(type || 'car');

    const make = this.toStr(terms.get('make1') ?? '');
    if (make) {
      clauses.push('make = ?');
      params.push(make);
    }

    const model = this.toStr(terms.get('model1') ?? '');
    if (model) {
      clauses.push('model = ?');
      params.push(model.replace(' (all)', ''));
    }

    this.addRangeClause(
      clauses,
      params,
      'registration',
      terms.get('registration'),
    );
    this.addRangeClause(clauses, params, 'price', terms.get('price'));
    this.addRangeClause(clauses, params, 'mileage', terms.get('mileage'));
    this.addInClause(
      clauses,
      params,
      'transmission',
      terms.get('transmission'),
    );
    this.addInClause(clauses, params, 'fuelType', terms.get('fuelType'));
    this.addInClause(clauses, params, 'bodyType', terms.get('bodyType'));
    this.addInClause(
      clauses,
      params,
      'emissionGroup',
      terms.get('emissionGroup'),
    );

    return { whereSql: `WHERE ${clauses.join(' AND ')}`, params };
  }

  private addInClause(
    clauses: string[],
    params: unknown[],
    key: string,
    raw: unknown,
  ) {
    const value = this.toStr(raw ?? '');
    if (!value) return;
    const values = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        if (
          !v.toLowerCase().includes('suv') &&
          !v.toLowerCase().includes('gas')
        ) {
          return v.replace(/-/g, ' ');
        }
        return v;
      });
    if (values.length === 0) return;
    clauses.push(`${key} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }

  private addRangeClause(
    clauses: string[],
    params: unknown[],
    key: string,
    raw: unknown,
  ) {
    if (!raw || typeof raw !== 'object') return;
    const value = raw as Record<string, unknown>;
    const from = this.toStr(value.from ?? '');
    const to = this.toStr(value.to ?? '');
    if (from) {
      clauses.push(`${key} > ?`);
      params.push(from);
    }
    if (to) {
      clauses.push(`${key} < ?`);
      params.push(to);
    }
  }

  private termMap(searchTerms: FilterTerm[]) {
    const map = new Map<string, unknown>();
    for (const term of searchTerms) {
      if (!term || typeof term.key !== 'string') continue;
      map.set(term.key, term.value);
    }
    return map;
  }

  private toStr(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
