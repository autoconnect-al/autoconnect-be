import { BadRequestException } from '@nestjs/common';
import { SearchDto } from '../../modules/search/dto/search.dto';

export function normalizeGeneralSearch(input?: string): string[] {
  if (!input) return [];

  const cleaned = input.replace(/,/g, ' ').toLowerCase();
  if (cleaned.length > 75) {
    throw new BadRequestException('General search too long');
  }

  let tokens = cleaned.split(/\s+/).slice(0, 10);

  tokens = tokens.map((t) => {
    if (t === 'benc') return 'benz';
    if (t === 'mercedez') return 'mercedes';
    if (['seri', 'seria', 'serija'].includes(t)) return 'series';
    if (['klas', 'klasa', 'clas'].includes(t)) return 'class';
    return t;
  });

  // T Max → Tmax
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === 't' && tokens[i + 1] === 'max') {
      tokens[i] = 'tmax';
      tokens.splice(i + 1, 1);
    }
  }

  // series swap
  for (let i = 0; i < tokens.length - 2; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const c = tokens[i + 2];

    const isBMW =
      a === 'bmw' || c === 'bmw';

    const isSeriesPattern =
      (b === 'series' && /^\d+$/.test(c)) ||
      (/^\d+$/.test(b) && c === 'series');

    if (isBMW && isSeriesPattern) {
      const seriesNumber = /^\d+$/.test(b) ? b : c;

      tokens.splice(i, 3, `${seriesNumber}-series`);
      break;
    }
  }

  // single-char merge
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length === 1 && !/^\d+$/.test(tokens[i])) {
      tokens[i] = /^\d+$/.test(tokens[i + 1])
        ? `${tokens[i]} ${tokens[i + 1]}`
        : `${tokens[i]}-${tokens[i + 1]}`;
      tokens.splice(i + 1, 1);
    }
  }

  // merge model numbers
  for (let i = 1; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i]) && !tokens[i - 1].includes('-')) {
      tokens[i - 1] =
        tokens[i - 1] === 'golf'
          ? `${tokens[i - 1]} ${tokens[i]}`
          : `${tokens[i - 1]}-${tokens[i]}`;
      tokens.splice(i, 1);
      i--;
    }
  }

  return tokens;
}

export function buildAdditionalFilters(query: SearchDto): {
  sql: string;
  params: any[];
} {
  const filters: string[] = [];
  const params: any[] = [];

  // Make / Model / Variant (up to 3)
  for (let i = 1; i <= 3; i++) {
    const make = query[`make${i}` as keyof SearchDto] as string | undefined;
    const model = query[`model${i}` as keyof SearchDto] as string | undefined;
    const variant = query[`variant${i}` as keyof SearchDto] as
      | string
      | undefined;

    if (make || model || variant) {
      const subFilters: string[] = [];
      if (make) {
        subFilters.push(`make = ?`);
        params.push(make);
      }
      if (model) {
        subFilters.push(`model = ?`);
        params.push(model);
      }
      if (variant) {
        subFilters.push(`variant = ?`);
        params.push(variant);
      }
      filters.push(`(${subFilters.join(' AND ')})`);
    }
  }

  // Price
  if (query.priceFrom != null) {
    filters.push(`price >= ?`);
    params.push(query.priceFrom);
  }
  if (query.priceTo != null) {
    filters.push(`price <= ?`);
    params.push(query.priceTo);
  }

  // Registration
  if (query.registrationFrom != null) {
    filters.push(`registration >= ?`);
    params.push(query.registrationFrom);
  }
  if (query.registrationTo != null) {
    filters.push(`registration <= ?`);
    params.push(query.registrationTo);
  }

  // Mileage
  if (query.mileageFrom != null) {
    filters.push(`mileage >= ?`);
    params.push(query.mileageFrom);
  }
  if (query.mileageTo != null) {
    filters.push(`mileage <= ?`);
    params.push(query.mileageTo);
  }

  // Body type, fuelType, emissionGroup
  if (query.bodyType) {
    filters.push(`bodyType = ?`);
    params.push(query.bodyType);
  }
  if (query.fuelType) {
    filters.push(`fuelType = ?`);
    params.push(query.fuelType);
  }
  if (query.emissionGroup) {
    filters.push(`emissionGroup = ?`);
    params.push(query.emissionGroup);
  }

  // Boolean filters
  if (query.customsPaid !== undefined) {
    filters.push(`customsPaid = ?`);
    params.push(query.customsPaid ? 1 : 0);
  }
  if (query.canExchange !== undefined) {
    filters.push(`canExchange = ?`);
    params.push(query.canExchange ? 1 : 0);
  }

  return {
    sql: filters.length ? `AND ${filters.join(' AND ')}` : '',
    params,
  };
}
