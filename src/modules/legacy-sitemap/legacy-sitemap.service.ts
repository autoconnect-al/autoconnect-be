import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacySuccess } from '../../common/legacy-response';

type SitemapRow = {
  id: string | number | bigint;
  make: string | null;
  model: string | null;
  accountName: string | null;
  type: string | null;
};

type MakeRow = {
  make: string | null;
  type: string | null;
};

type MakeModelRow = {
  make: string | null;
  model: string | null;
  type: string | null;
};

type SitemapItem = {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: string;
  alternates: {
    languages: {
      'sq-al': string;
      en: string;
    };
  };
};

type ArticleSitemapPathConfig = {
  path: Record<string, string>;
  defaultLocale: string;
  urlUsesLocale: boolean;
  baseUrl: string;
};

@Injectable()
export class LegacySitemapService {
  private readonly locales = {
    en: 'en',
    sqAl: 'sq-al',
  } as const;

  private readonly defaultLocale = 'sq-al';

  private readonly pathNames: Record<string, { en: string; 'sq-al': string }> =
    {
      '/rreth-nesh': {
        en: '/about',
        'sq-al': '/rreth-nesh',
      },
      '/te-preferuarat': {
        en: '/favourites',
        'sq-al': '/te-preferuarat',
      },
      '/automjete/makina-ne-shitje/koreane': {
        en: '/vehicles/cars-for-sale/korean',
        'sq-al': '/automjete/makina-ne-shitje/koreane',
      },
      '/automjete/makina-ne-shitje/elektrike': {
        en: '/vehicles/cars-for-sale/electric',
        'sq-al': '/automjete/makina-ne-shitje/elektrike',
      },
      '/automjete/makina-ne-shitje/retro': {
        en: '/vehicles/cars-for-sale/retro',
        'sq-al': '/automjete/makina-ne-shitje/retro',
      },
      '/automjete/makina-ne-shitje/okazion': {
        en: '/vehicles/cars-for-sale/merrjep-al-car-deals',
        'sq-al': '/automjete/makina-ne-shitje/okazion',
      },
      '/automjete/makina-ne-shitje/[[...params]]': {
        en: '/vehicles/cars-for-sale/[[...params]]',
        'sq-al': '/automjete/makina-ne-shitje/[[...params]]',
      },
      '/automjete/makine-ne-shitje/[id]': {
        en: '/vehicles/car-for-sale/[id]',
        'sq-al': '/automjete/makine-ne-shitje/[id]',
      },
      '/automjete/motorra-ne-shitje/[[...params]]': {
        en: '/vehicles/motorbikes-for-sale/[[...params]]',
        'sq-al': '/automjete/motorra-ne-shitje/[[...params]]',
      },
      '/automjete/motorr-ne-shitje/[id]': {
        en: '/vehicles/motorbikes-for-sale/[id]',
        'sq-al': '/automjete/motorr-ne-shitje/[id]',
      },
      '/automjete/keshilla': {
        en: '/vehicles/blog-articles',
        'sq-al': '/automjete/keshilla',
      },
      '/automjete/keshille': {
        en: '/vehicles/blog-article',
        'sq-al': '/automjete/keshille',
      },
      '/automjete-ne-shitje/[name]/[[...params]]': {
        en: '/vehicles-for-sale/[name]/[[...params]]',
        'sq-al': '/automjete-ne-shitje/[name]/[[...params]]',
      },
    };

  private readonly articlePathNames: Record<string, ArticleSitemapPathConfig> =
    {
      autoconnect: {
        path: {
          en: '/article/[articleId]',
          'sq-al': '/artikull/[articleId]',
        },
        baseUrl: '',
        defaultLocale: 'sq-al',
        urlUsesLocale: true,
      },
      'rd-construction': {
        path: {
          en: '/blog/[categoryId]/article/[articleId]',
        },
        baseUrl: 'https://rdconstruction.us',
        defaultLocale: 'en',
        urlUsesLocale: false,
      },
      'rent-a-car-in-tirana': {
        path: {
          en: '/blog/[categoryId]/article/[articleId]',
        },
        baseUrl: 'https://rentacarintirana.autoconnect.al',
        defaultLocale: 'en',
        urlUsesLocale: false,
      },
    };

  constructor(private readonly prisma: PrismaService) {}

  async getDefaultSitemap() {
    const result = await this.getSitemapForAutoconnect();
    return legacySuccess(result);
  }

  async getSitemapForApp(_appName: string) {
    const result = await this.getSitemapForArticleApp(_appName);
    return legacySuccess(result);
  }

  private async getSitemapForAutoconnect(): Promise<SitemapItem[]> {
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
    const sitemapData = await this.prisma.$queryRawUnsafe<SitemapRow[]>(
      'SELECT id, make, model, accountName, type FROM search',
    );
    const makes = await this.prisma.$queryRawUnsafe<MakeRow[]>(
      'SELECT DISTINCT make, type FROM search',
    );
    const carMakeModels = await this.prisma.$queryRawUnsafe<MakeModelRow[]>(
      'SELECT DISTINCT make, model, type FROM search',
    );

    const acc: SitemapItem[] = [];

    for (const [path, pathLocales] of Object.entries(this.pathNames)) {
      if (path === '/automjete/makine-ne-shitje/[id]') {
        for (const data of sitemapData) {
          if ((data.type ?? '').toLowerCase() !== 'car') continue;
          const make = this.encodePathComponent(data.make);
          const model = this.encodePathComponent(data.model);
          const id = `${make}-${model}-${String(data.id ?? '')}`;
          const alPath = path.replace('[id]', id);
          const enPath = pathLocales.en.replace('[id]', id);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'monthly', '0.6'));
        }
        continue;
      }

      if (path === '/automjete/motorr-ne-shitje/[id]') {
        for (const data of sitemapData) {
          if ((data.type ?? '').toLowerCase() !== 'motorcycle') continue;
          const make = this.encodePathComponent(data.make);
          const model = this.encodePathComponent(data.model);
          const id = `${make}-${model}-${String(data.id ?? '')}`;
          const alPath = path.replace('[id]', id);
          const enPath = pathLocales.en.replace('[id]', id);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'monthly', '0.6'));
        }
        continue;
      }

      if (path === '/automjete-ne-shitje/[name]/[[...params]]') {
        for (const data of sitemapData) {
          if (!data.accountName) continue;

          const alBase = path
            .replace('[name]', data.accountName)
            .replace('[[...params]]', '');
          const enBase = pathLocales.en
            .replace('[name]', data.accountName)
            .replace('[[...params]]', '');
          acc.push(this.makeItem(baseUrl, alBase, enBase, 'weekly', '0.6'));

          const makePath = this.plusSpaces(data.make);
          const alMake = `${alBase}${makePath}`;
          const enMake = `${enBase}${makePath}`;
          acc.push(this.makeItem(baseUrl, alMake, enMake, 'daily', '0.8'));

          const make = this.encodePathComponent(data.make);
          const model = this.encodePathComponent(data.model);
          const alMakeModel = `${alBase}${make}/${model}`;
          const enMakeModel = `${enBase}${make}/${model}`;
          acc.push(
            this.makeItem(baseUrl, alMakeModel, enMakeModel, 'daily', '0.8'),
          );
        }
        continue;
      }

      if (path === '/automjete/motorra-ne-shitje/[[...params]]') {
        for (const makeRow of makes) {
          if ((makeRow.type ?? '').toLowerCase() !== 'motorcycle') continue;
          const make = this.encodePathComponent(makeRow.make);
          const alPath = path.replace('[[...params]]', make);
          const enPath = pathLocales.en.replace('[[...params]]', make);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'daily', '0.7'));
        }

        for (const row of carMakeModels) {
          if ((row.type ?? '').toLowerCase() !== 'motorcycle') continue;
          const make = this.encodePathComponent(row.make);
          const model = this.encodePathComponent(row.model);
          const params = `${make}/${model}`;
          const alPath = path.replace('[[...params]]', params);
          const enPath = pathLocales.en.replace('[[...params]]', params);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'daily', '0.4'));
        }
        continue;
      }

      if (path === '/automjete/makina-ne-shitje/[[...params]]') {
        for (const makeRow of makes) {
          if ((makeRow.type ?? '').toLowerCase() !== 'car') continue;
          const make = this.encodePathComponent(makeRow.make);
          const alPath = path.replace('[[...params]]', make);
          const enPath = pathLocales.en.replace('[[...params]]', make);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'daily', '0.7'));
        }

        for (const row of carMakeModels) {
          if ((row.type ?? '').toLowerCase() !== 'car') continue;
          const make = this.encodePathComponent(row.make);
          const model = this.encodePathComponent(row.model);
          const params = `${make}/${model}`;
          const alPath = path.replace('[[...params]]', params);
          const enPath = pathLocales.en.replace('[[...params]]', params);
          acc.push(this.makeItem(baseUrl, alPath, enPath, 'daily', '0.4'));
        }
        continue;
      }

      acc.push(this.makeItem(baseUrl, path, pathLocales.en, 'daily', '0.8'));
    }

    return acc;
  }

  private makeItem(
    baseUrl: string,
    alPath: string,
    enPath: string,
    changeFrequency: string,
    priority: string,
  ): SitemapItem {
    const now = new Date().toISOString();
    return {
      url: `${baseUrl}/${this.defaultLocale}${alPath}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          'sq-al': `${baseUrl}/${this.locales.sqAl}${alPath}`,
          en: `${baseUrl}/${this.locales.en}${enPath}`,
        },
      },
    };
  }

  private plusSpaces(value: string | null): string {
    return (value ?? '').replace(/\s+/g, '+');
  }

  private encodePathComponent(value: string | null): string {
    return encodeURIComponent(this.plusSpaces(value));
  }

  private async getSitemapForArticleApp(
    appNameLocale: string,
  ): Promise<SitemapItem[]> {
    const requestedAppName = this.toText(appNameLocale).trim();
    const config = this.articlePathNames[requestedAppName];
    if (!config) {
      return [];
    }

    const articles = await this.prisma.article.findMany({
      where: {
        deleted: false,
        appName: requestedAppName,
      },
      orderBy: {
        dateCreated: 'desc',
      },
      select: {
        id: true,
        category: true,
        data: true,
      },
    });

    const acc: SitemapItem[] = [];
    for (const data of articles) {
      const titleAl = this.getArticleSlug(data.data, 'sq-al');
      const titleEn = this.getArticleSlug(data.data, 'en');

      const pathForSqAl = config.path[this.locales.sqAl];
      const pathForEn = config.path[this.locales.en];

      const articleUrlAl = pathForSqAl
        ? this.replaceParamsInPath(
            pathForSqAl,
            this.toText(data.id),
            this.toText(data.category),
            titleAl,
          )
        : null;
      const articleUrlEn = pathForEn
        ? this.replaceParamsInPath(
            pathForEn,
            this.toText(data.id),
            this.toText(data.category),
            titleEn,
          )
        : null;

      const defaultUrl =
        config.defaultLocale === this.locales.sqAl
          ? (articleUrlAl ?? articleUrlEn)
          : (articleUrlEn ?? articleUrlAl);
      if (!defaultUrl) continue;

      const defaultLocale = config.urlUsesLocale ? config.defaultLocale : null;
      const alAlternate = articleUrlAl
        ? this.buildUrl(
            articleUrlAl,
            config.baseUrl,
            config.urlUsesLocale ? this.locales.sqAl : null,
          )
        : null;
      const enAlternate = articleUrlEn
        ? this.buildUrl(
            articleUrlEn,
            config.baseUrl,
            config.urlUsesLocale ? this.locales.en : null,
          )
        : null;

      acc.push({
        url: this.buildUrl(defaultUrl, config.baseUrl, defaultLocale),
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: '0.8',
        alternates: {
          languages: {
            'sq-al': alAlternate ?? '',
            en: enAlternate ?? '',
          },
        },
      });
    }

    return acc;
  }

  private replaceParamsInPath(
    path: string,
    articleId: string,
    categoryId: string,
    title: string | null,
  ): string | null {
    if (!title) return null;
    const withCategory = path.replace('[categoryId]', `cat_${categoryId}`);
    return withCategory.replace('[articleId]', `${title}-${articleId}`);
  }

  private buildUrl(
    path: string,
    baseUrl: string,
    locale: string | null,
  ): string {
    if (locale) return `${baseUrl}/${locale}${path}`;
    return `${baseUrl}${path}`;
  }

  private getArticleSlug(data: unknown, language: string): string | null {
    if (!data) return null;
    try {
      const raw = this.coerceJsonString(data);
      if (!raw) return null;
      const articles = JSON.parse(raw) as Array<{
        language?: string;
        title?: string;
      }>;
      if (!Array.isArray(articles)) return null;
      const article = articles.find((entry) => entry?.language === language);
      if (!article?.title) return null;
      return article.title.replace(/\s+/g, '-');
    } catch {
      return null;
    }
  }

  private coerceJsonString(data: unknown): string | null {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf8');
    if (data instanceof Uint8Array) return Buffer.from(data).toString('utf8');
    if (Array.isArray(data)) return JSON.stringify(data);
    if (data && typeof data === 'object') return JSON.stringify(data);
    return null;
  }

  private toText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint')
      return String(value);
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
    return String(value ?? '');
  }
}
