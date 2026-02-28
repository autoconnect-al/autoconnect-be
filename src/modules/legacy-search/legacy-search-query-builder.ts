export type FilterTerm = {
  key: string;
  value: unknown;
};

export type SearchFilter = {
  type?: string;
  keyword?: string;
  generalSearch?: string;
  searchTerms?: FilterTerm[];
  sortTerms?: Array<{ key?: string; order?: string }>;
  page?: number | string;
  maxResults?: number | string;
};

export class LegacySearchQueryBuilder {
  private readonly skipQuickSearchFix = new Set(['benz', 'mercedes']);

  parseFilter(filterRaw: string | undefined): SearchFilter | null {
    if (!filterRaw || typeof filterRaw !== 'string') return null;
    try {
      const parsed = JSON.parse(filterRaw) as SearchFilter;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  extractRegistrationFrom(registrationRaw: unknown): number | null {
    if (!registrationRaw || typeof registrationRaw !== 'object') return null;
    const fromValue = (registrationRaw as Record<string, unknown>).from;
    const from = Number(this.toStr(fromValue));
    if (!Number.isFinite(from) || from <= 0) return null;
    return from;
  }

  parseCsvValues(raw: string | undefined): string[] {
    return (raw ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  buildSortAndPagination(filter: SearchFilter) {
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

  buildWhere(filter: SearchFilter) {
    const terms = this.termMap(filter.searchTerms ?? []);
    const clauses: string[] = [`sold = 0`, `deleted = '0'`];
    const params: unknown[] = [];
    const keyword = this.toStr(filter.keyword ?? '').toLowerCase();
    const vendorAccountName = this.toStr(terms.get('vendorAccountName') ?? '');
    const isVendorSearch = Boolean(vendorAccountName);
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
    this.addCustomsPaidClause(clauses, params, terms.get('customsPaid'));
    if (vendorAccountName) {
      clauses.push('accountName = ?');
      params.push(vendorAccountName);
    }

    this.applyKeywordClauses(clauses, params, keyword, isVendorSearch);
    this.applyGeneralSearchClauses(
      clauses,
      params,
      this.toStr(filter.generalSearch ?? ''),
    );

    return { whereSql: `WHERE ${clauses.join(' AND ')}`, params };
  }

  private applyKeywordClauses(
    clauses: string[],
    params: unknown[],
    keyword: string,
    isVendorSearch: boolean,
  ) {
    const options = keyword
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!keyword) {
      if (!isVendorSearch) {
        clauses.push('(vendorId != 1 OR vendorId IS NULL)');
      }
      return;
    }

    if (keyword === 'encar') {
      clauses.push('vendorId = 1');
    } else {
      clauses.push('(vendorId != 1 OR vendorId IS NULL)');
    }

    const hasOfferKeyword = options.some(
      (option) => option === 'okazion' || option === 'oferte',
    );
    if (hasOfferKeyword) {
      clauses.push('price > 1');
      clauses.push('minPrice > 1');
      clauses.push('maxPrice > 1');
      clauses.push('((price - minPrice) / (maxPrice - price) < 0.25)');
      const remainingOptions = options.filter(
        (option) => option !== 'okazion' && option !== 'oferte',
      );
      if (remainingOptions.length > 0) {
        clauses.push(
          `(${remainingOptions.map(() => 'cleanedCaption LIKE ?').join(' OR ')})`,
        );
        for (const option of remainingOptions) {
          params.push(`%${option}%`);
        }
      }
      return;
    }

    if (keyword === 'retro') {
      clauses.push('(cleanedCaption LIKE ? OR registration < ?)');
      params.push('%retro%', String(new Date().getFullYear() - 30));
      return;
    }

    if (keyword === 'korea') {
      clauses.push('(cleanedCaption LIKE ? OR accountName LIKE ?)');
      params.push('%korea%', '%korea%');
      return;
    }

    if (keyword !== 'elektrike') {
      if (options.length > 0) {
        clauses.push(
          `(${options.map(() => 'cleanedCaption LIKE ?').join(' OR ')})`,
        );
        for (const option of options) {
          params.push(`%${option}%`);
        }
      }
    }
  }

  private applyGeneralSearchClauses(
    clauses: string[],
    params: unknown[],
    generalSearch: string,
  ) {
    const normalizedInput = generalSearch.replace(/,/g, ' ').trim();
    if (!normalizedInput) return;
    if (normalizedInput.length > 75) return;

    const tokens = this.normalizeGeneralSearchTokens(normalizedInput).slice(
      0,
      10,
    );
    if (tokens.length === 0) return;

    for (const token of tokens) {
      clauses.push(
        '(cleanedCaption LIKE ? OR make LIKE ? OR model LIKE ? OR variant LIKE ? OR registration LIKE ? OR fuelType LIKE ?)',
      );
      const value = `%${token}%`;
      params.push(value, value, value, value, value, value);
    }
  }

  private normalizeGeneralSearchTokens(input: string): string[] {
    let tokens = input
      .split(' ')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    tokens = tokens.map((token) => {
      if (token === 'benc') return 'benz';
      if (token === 'mercedez') return 'mercedes';
      if (token === 'seri' || token === 'seria' || token === 'serija') {
        return 'series';
      }
      if (token === 'klas' || token === 'klasa' || token === 'clas') {
        return 'class';
      }
      return token;
    });

    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i] === 't' && tokens[i + 1] === 'max') {
        tokens[i] = 'tmax';
        tokens.splice(i + 1, 1);
      }
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i] === 'series') {
        const tmp = tokens[i];
        tokens[i] = tokens[i + 1];
        tokens[i + 1] = tmp;
      }
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const current = tokens[i];
      const next = tokens[i + 1];
      if (
        current.length === 1 &&
        !this.isNumeric(current) &&
        !this.skipQuickSearchFix.has(current)
      ) {
        tokens[i] = this.isNumeric(next)
          ? `${current} ${next}`
          : `${current}-${next}`;
        tokens.splice(i + 1, 1);
        i -= 1;
      }
    }

    for (let i = 1; i < tokens.length; i += 1) {
      const current = tokens[i];
      const prev = tokens[i - 1];
      if (
        this.isNumeric(current) &&
        !this.isNumeric(prev) &&
        !prev.includes('-') &&
        !this.skipQuickSearchFix.has(prev) &&
        !current.includes('.')
      ) {
        tokens[i - 1] =
          prev === 'golf' ? `${prev} ${current}` : `${prev}-${current}`;
        tokens.splice(i, 1);
        i -= 1;
      }
    }

    return tokens;
  }

  private isNumeric(value: string): boolean {
    if (!value) return false;
    return !Number.isNaN(Number(value));
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

  private addCustomsPaidClause(
    clauses: string[],
    params: unknown[],
    raw: unknown,
  ) {
    const value = this.toStr(raw ?? '');
    if (!value) return;
    if (value === '1' || value.toLowerCase() === 'true') {
      clauses.push('(customsPaid = 1 OR customsPaid IS NULL)');
      return;
    }
    if (value === '0' || value.toLowerCase() === 'false') {
      clauses.push('customsPaid = 0');
      return;
    }
    clauses.push('customsPaid = ?');
    params.push(value);
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
}
