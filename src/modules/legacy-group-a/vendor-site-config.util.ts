type AnyRecord = Record<string, unknown>;

const SECTION_TYPES = new Set([
  'hero',
  'mediaText',
  'richText',
  'testimonials',
  'imageCarousel',
  'contactForm',
  'map',
  'footer',
]);

const PAGE_KEYS = ['home', 'about', 'contact'] as const;
const THEME_COMPONENT_KEYS = [
  'hero',
  'mediaText',
  'richText',
  'testimonials',
  'imageCarousel',
  'contactForm',
  'map',
  'footer',
] as const;
const ALLOWED_STYLE_TOKEN_KEYS = new Set([
  '--builder-bg',
  '--builder-surface',
  '--builder-text',
  '--builder-muted-text',
  '--builder-border',
  '--builder-accent',
  '--builder-accent-contrast',
]);
const SAFE_COLOR_KEYWORDS = new Set([
  'transparent',
  'inherit',
  'initial',
  'currentcolor',
  'white',
  'black',
]);

const MAX_SITE_CONFIG_BYTES = 90 * 1024;
const MAX_SECTIONS_PER_PAGE = 24;
const MAX_SECTION_ID_LENGTH = 80;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_MEDIUM_TEXT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(
  value: unknown,
  maxLength: number,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: 'must be a string' };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: 'must not be empty' };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `must not exceed ${maxLength} chars` };
  }
  return { ok: true, value: trimmed };
}

function normalizeOptionalString(
  value: unknown,
  maxLength: number,
): ParseResult<string | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined };
  }
  const normalized = normalizeString(value, maxLength);
  if (!normalized.ok) {
    return normalized;
  }
  return { ok: true, value: normalized.value };
}

function isSafeCssTokenValue(value: string): boolean {
  if (value.length > 80) return false;
  if (/[;<>{}]/.test(value)) return false;

  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true;
  if (/^(rgb|hsl)a?\([0-9.,%\s]+\)$/.test(value)) return true;
  if (/^var\(--[a-z0-9-]+\)$/i.test(value)) return true;
  if (SAFE_COLOR_KEYWORDS.has(value.toLowerCase())) return true;

  return false;
}

function normalizeStyleTokens(
  input: unknown,
  path: string,
): ParseResult<Record<string, string> | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!ALLOWED_STYLE_TOKEN_KEYS.has(key)) {
      return { ok: false, error: `${path}.${key} is not an allowed token` };
    }
    if (typeof rawValue !== 'string') {
      return { ok: false, error: `${path}.${key} must be a string` };
    }
    const value = rawValue.trim();
    if (!value) {
      return { ok: false, error: `${path}.${key} must not be empty` };
    }
    if (!isSafeCssTokenValue(value)) {
      return {
        ok: false,
        error: `${path}.${key} has an invalid token value`,
      };
    }
    normalized[key] = value;
  }

  return { ok: true, value: normalized };
}

function normalizeUrl(
  value: unknown,
  opts: { allowRelative?: boolean; httpsOnly?: boolean },
  path: string,
): ParseResult<string> {
  const normalized = normalizeString(value, MAX_URL_LENGTH);
  if (!normalized.ok) {
    return { ok: false, error: `${path} ${normalized.error}` };
  }
  const url = normalized.value;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return { ok: false, error: `${path} protocol is not allowed` };
  }

  if (opts.allowRelative && (url.startsWith('/') || url.startsWith('#'))) {
    return { ok: true, value: url };
  }

  try {
    const parsed = new URL(url);
    if (opts.httpsOnly && parsed.protocol !== 'https:') {
      return { ok: false, error: `${path} must use https` };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: `${path} has unsupported protocol` };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: `${path} must be a valid URL` };
  }
}

function normalizeMapEmbedUrl(value: unknown, path: string): ParseResult<string> {
  const normalized = normalizeUrl(
    value,
    { allowRelative: false, httpsOnly: true },
    path,
  );
  if (!normalized.ok) {
    return normalized;
  }
  const url = normalized.value;
  if (/[\s<>"'`]/.test(url)) {
    return { ok: false, error: `${path} contains unsafe characters` };
  }
  return { ok: true, value: url };
}

function normalizeHeroData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'hero.data must be an object' };
  }
  const heading = normalizeString(input.heading, MAX_SHORT_TEXT_LENGTH);
  if (!heading.ok) return { ok: false, error: `hero.data.heading ${heading.error}` };

  const subheading = normalizeOptionalString(
    input.subheading,
    MAX_MEDIUM_TEXT_LENGTH,
  );
  if (!subheading.ok) {
    return { ok: false, error: `hero.data.subheading ${subheading.error}` };
  }

  const backgroundImageUrl =
    input.backgroundImageUrl === undefined || input.backgroundImageUrl === null
      ? ({ ok: true, value: undefined } as ParseResult<string | undefined>)
      : normalizeUrl(
          input.backgroundImageUrl,
          { allowRelative: false, httpsOnly: false },
          'hero.data.backgroundImageUrl',
        );
  if (!backgroundImageUrl.ok) {
    return { ok: false, error: backgroundImageUrl.error };
  }

  let cta: AnyRecord | undefined;
  if (input.cta !== undefined && input.cta !== null) {
    if (!isRecord(input.cta)) {
      return { ok: false, error: 'hero.data.cta must be an object' };
    }
    const label = normalizeString(input.cta.label, 60);
    if (!label.ok) return { ok: false, error: `hero.data.cta.label ${label.error}` };
    const url = normalizeUrl(
      input.cta.url,
      { allowRelative: true, httpsOnly: false },
      'hero.data.cta.url',
    );
    if (!url.ok) return { ok: false, error: url.error };
    cta = { label: label.value, url: url.value };
  }

  return {
    ok: true,
    value: {
      heading: heading.value,
      ...(subheading.value ? { subheading: subheading.value } : {}),
      ...(backgroundImageUrl.value
        ? { backgroundImageUrl: backgroundImageUrl.value }
        : {}),
      ...(cta ? { cta } : {}),
    },
  };
}

function normalizeMediaTextData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'mediaText.data must be an object' };
  }
  const title = normalizeString(input.title, MAX_SHORT_TEXT_LENGTH);
  if (!title.ok) return { ok: false, error: `mediaText.data.title ${title.error}` };

  const body = normalizeString(input.body, MAX_LONG_TEXT_LENGTH);
  if (!body.ok) return { ok: false, error: `mediaText.data.body ${body.error}` };

  const mediaPositionValue =
    typeof input.mediaPosition === 'string'
      ? input.mediaPosition.trim().toLowerCase()
      : 'left';
  if (!['left', 'right'].includes(mediaPositionValue)) {
    return { ok: false, error: 'mediaText.data.mediaPosition must be left or right' };
  }

  const mediaUrl =
    input.mediaUrl === undefined || input.mediaUrl === null
      ? ({ ok: true, value: undefined } as ParseResult<string | undefined>)
      : normalizeUrl(
          input.mediaUrl,
          { allowRelative: false, httpsOnly: false },
          'mediaText.data.mediaUrl',
        );
  if (!mediaUrl.ok) return { ok: false, error: mediaUrl.error };

  const mediaAlt = normalizeOptionalString(input.mediaAlt, MAX_SHORT_TEXT_LENGTH);
  if (!mediaAlt.ok) return { ok: false, error: `mediaText.data.mediaAlt ${mediaAlt.error}` };

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      mediaPosition: mediaPositionValue,
      ...(mediaUrl.value ? { mediaUrl: mediaUrl.value } : {}),
      ...(mediaAlt.value ? { mediaAlt: mediaAlt.value } : {}),
    },
  };
}

function normalizeRichTextData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'richText.data must be an object' };
  }
  if (!Array.isArray(input.paragraphs) || input.paragraphs.length === 0) {
    return { ok: false, error: 'richText.data.paragraphs must be a non-empty array' };
  }
  if (input.paragraphs.length > 16) {
    return { ok: false, error: 'richText.data.paragraphs exceeds max allowed size' };
  }

  const paragraphs: string[] = [];
  for (let i = 0; i < input.paragraphs.length; i += 1) {
    const paragraph = normalizeString(input.paragraphs[i], MAX_LONG_TEXT_LENGTH);
    if (!paragraph.ok) {
      return { ok: false, error: `richText.data.paragraphs[${i}] ${paragraph.error}` };
    }
    paragraphs.push(paragraph.value);
  }

  return { ok: true, value: { paragraphs } };
}

function normalizeTestimonialsData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'testimonials.data must be an object' };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'testimonials.data.items must be a non-empty array' };
  }
  if (input.items.length > 12) {
    return { ok: false, error: 'testimonials.data.items exceeds max allowed size' };
  }

  const items: AnyRecord[] = [];
  for (let i = 0; i < input.items.length; i += 1) {
    const item = input.items[i];
    if (!isRecord(item)) {
      return { ok: false, error: `testimonials.data.items[${i}] must be an object` };
    }
    const quote = normalizeString(item.quote, MAX_MEDIUM_TEXT_LENGTH);
    if (!quote.ok) {
      return { ok: false, error: `testimonials.data.items[${i}].quote ${quote.error}` };
    }
    const author = normalizeString(item.author, MAX_SHORT_TEXT_LENGTH);
    if (!author.ok) {
      return { ok: false, error: `testimonials.data.items[${i}].author ${author.error}` };
    }
    const role = normalizeOptionalString(item.role, MAX_SHORT_TEXT_LENGTH);
    if (!role.ok) {
      return { ok: false, error: `testimonials.data.items[${i}].role ${role.error}` };
    }
    items.push({
      quote: quote.value,
      author: author.value,
      ...(role.value ? { role: role.value } : {}),
    });
  }

  return { ok: true, value: { items } };
}

function normalizeImageCarouselData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'imageCarousel.data must be an object' };
  }
  if (!Array.isArray(input.images) || input.images.length === 0) {
    return { ok: false, error: 'imageCarousel.data.images must be a non-empty array' };
  }
  if (input.images.length > 20) {
    return { ok: false, error: 'imageCarousel.data.images exceeds max allowed size' };
  }

  const images: AnyRecord[] = [];
  for (let i = 0; i < input.images.length; i += 1) {
    const image = input.images[i];
    if (!isRecord(image)) {
      return { ok: false, error: `imageCarousel.data.images[${i}] must be an object` };
    }
    const url = normalizeUrl(
      image.url,
      { allowRelative: false, httpsOnly: false },
      `imageCarousel.data.images[${i}].url`,
    );
    if (!url.ok) return { ok: false, error: url.error };

    const alt = normalizeOptionalString(
      image.alt,
      MAX_SHORT_TEXT_LENGTH,
    );
    if (!alt.ok) {
      return { ok: false, error: `imageCarousel.data.images[${i}].alt ${alt.error}` };
    }

    images.push({
      url: url.value,
      ...(alt.value ? { alt: alt.value } : {}),
    });
  }

  return { ok: true, value: { images } };
}

function normalizeContactFormData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'contactForm.data must be an object' };
  }

  const title = normalizeOptionalString(input.title, MAX_SHORT_TEXT_LENGTH);
  if (!title.ok) return { ok: false, error: `contactForm.data.title ${title.error}` };
  const description = normalizeOptionalString(
    input.description,
    MAX_MEDIUM_TEXT_LENGTH,
  );
  if (!description.ok) {
    return { ok: false, error: `contactForm.data.description ${description.error}` };
  }
  const submitLabel = normalizeOptionalString(input.submitLabel, 40);
  if (!submitLabel.ok) {
    return { ok: false, error: `contactForm.data.submitLabel ${submitLabel.error}` };
  }

  return {
    ok: true,
    value: {
      ...(title.value ? { title: title.value } : {}),
      ...(description.value ? { description: description.value } : {}),
      ...(submitLabel.value ? { submitLabel: submitLabel.value } : {}),
    },
  };
}

function normalizeMapData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'map.data must be an object' };
  }
  const embedUrl = normalizeMapEmbedUrl(input.embedUrl, 'map.data.embedUrl');
  if (!embedUrl.ok) return embedUrl;

  const title = normalizeOptionalString(input.title, MAX_SHORT_TEXT_LENGTH);
  if (!title.ok) return { ok: false, error: `map.data.title ${title.error}` };

  return {
    ok: true,
    value: {
      embedUrl: embedUrl.value,
      ...(title.value ? { title: title.value } : {}),
    },
  };
}

function normalizeFooterData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'footer.data must be an object' };
  }
  const brandTitle = normalizeString(input.brandTitle, MAX_SHORT_TEXT_LENGTH);
  if (!brandTitle.ok) {
    return { ok: false, error: `footer.data.brandTitle ${brandTitle.error}` };
  }
  const brandDescription = normalizeOptionalString(
    input.brandDescription,
    MAX_MEDIUM_TEXT_LENGTH,
  );
  if (!brandDescription.ok) {
    return {
      ok: false,
      error: `footer.data.brandDescription ${brandDescription.error}`,
    };
  }
  const copyright = normalizeOptionalString(input.copyright, MAX_SHORT_TEXT_LENGTH);
  if (!copyright.ok) {
    return { ok: false, error: `footer.data.copyright ${copyright.error}` };
  }

  let linkGroups: AnyRecord[] | undefined;
  if (input.linkGroups !== undefined && input.linkGroups !== null) {
    if (!Array.isArray(input.linkGroups)) {
      return { ok: false, error: 'footer.data.linkGroups must be an array' };
    }
    if (input.linkGroups.length > 3) {
      return { ok: false, error: 'footer.data.linkGroups exceeds max allowed size' };
    }
    linkGroups = [];
    for (let i = 0; i < input.linkGroups.length; i += 1) {
      const group = input.linkGroups[i];
      if (!isRecord(group)) {
        return { ok: false, error: `footer.data.linkGroups[${i}] must be an object` };
      }
      const title = normalizeString(group.title, 80);
      if (!title.ok) {
        return {
          ok: false,
          error: `footer.data.linkGroups[${i}].title ${title.error}`,
        };
      }
      if (!Array.isArray(group.links) || group.links.length === 0) {
        return {
          ok: false,
          error: `footer.data.linkGroups[${i}].links must be a non-empty array`,
        };
      }
      if (group.links.length > 10) {
        return {
          ok: false,
          error: `footer.data.linkGroups[${i}].links exceeds max allowed size`,
        };
      }

      const links: AnyRecord[] = [];
      for (let j = 0; j < group.links.length; j += 1) {
        const link = group.links[j];
        if (!isRecord(link)) {
          return {
            ok: false,
            error: `footer.data.linkGroups[${i}].links[${j}] must be an object`,
          };
        }
        const label = normalizeString(link.label, 80);
        if (!label.ok) {
          return {
            ok: false,
            error: `footer.data.linkGroups[${i}].links[${j}].label ${label.error}`,
          };
        }
        const url = normalizeUrl(
          link.url,
          { allowRelative: true, httpsOnly: false },
          `footer.data.linkGroups[${i}].links[${j}].url`,
        );
        if (!url.ok) return { ok: false, error: url.error };

        links.push({ label: label.value, url: url.value });
      }

      linkGroups.push({
        title: title.value,
        links,
      });
    }
  }

  let socialLinks: AnyRecord[] | undefined;
  if (input.socialLinks !== undefined && input.socialLinks !== null) {
    if (!Array.isArray(input.socialLinks)) {
      return { ok: false, error: 'footer.data.socialLinks must be an array' };
    }
    if (input.socialLinks.length > 10) {
      return { ok: false, error: 'footer.data.socialLinks exceeds max allowed size' };
    }
    socialLinks = [];
    for (let i = 0; i < input.socialLinks.length; i += 1) {
      const social = input.socialLinks[i];
      if (!isRecord(social)) {
        return { ok: false, error: `footer.data.socialLinks[${i}] must be an object` };
      }
      const platform = normalizeString(social.platform, 40);
      if (!platform.ok) {
        return {
          ok: false,
          error: `footer.data.socialLinks[${i}].platform ${platform.error}`,
        };
      }
      const url = normalizeUrl(
        social.url,
        { allowRelative: false, httpsOnly: true },
        `footer.data.socialLinks[${i}].url`,
      );
      if (!url.ok) return { ok: false, error: url.error };
      socialLinks.push({ platform: platform.value, url: url.value });
    }
  }

  return {
    ok: true,
    value: {
      brandTitle: brandTitle.value,
      ...(brandDescription.value ? { brandDescription: brandDescription.value } : {}),
      ...(copyright.value ? { copyright: copyright.value } : {}),
      ...(linkGroups ? { linkGroups } : {}),
      ...(socialLinks ? { socialLinks } : {}),
    },
  };
}

function normalizeSection(section: unknown, index: number): ParseResult<AnyRecord> {
  if (!isRecord(section)) {
    return { ok: false, error: `sections[${index}] must be an object` };
  }
  const id = normalizeString(section.id, MAX_SECTION_ID_LENGTH);
  if (!id.ok) {
    return { ok: false, error: `sections[${index}].id ${id.error}` };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id.value)) {
    return { ok: false, error: `sections[${index}].id has invalid format` };
  }
  const sectionType =
    typeof section.type === 'string' ? section.type.trim() : '';
  if (!SECTION_TYPES.has(sectionType)) {
    return { ok: false, error: `sections[${index}].type is not supported` };
  }

  const styleTokens = normalizeStyleTokens(
    section.styleTokens,
    `sections[${index}].styleTokens`,
  );
  if (!styleTokens.ok) return styleTokens;

  let data: ParseResult<AnyRecord>;
  switch (sectionType) {
    case 'hero':
      data = normalizeHeroData(section.data);
      break;
    case 'mediaText':
      data = normalizeMediaTextData(section.data);
      break;
    case 'richText':
      data = normalizeRichTextData(section.data);
      break;
    case 'testimonials':
      data = normalizeTestimonialsData(section.data);
      break;
    case 'imageCarousel':
      data = normalizeImageCarouselData(section.data);
      break;
    case 'contactForm':
      data = normalizeContactFormData(section.data);
      break;
    case 'map':
      data = normalizeMapData(section.data);
      break;
    case 'footer':
      data = normalizeFooterData(section.data);
      break;
    default:
      data = { ok: false, error: `sections[${index}].type is not supported` };
      break;
  }

  if (!data.ok) {
    return { ok: false, error: `sections[${index}]: ${data.error}` };
  }

  return {
    ok: true,
    value: {
      id: id.value,
      type: sectionType,
      data: data.value,
      ...(styleTokens.value ? { styleTokens: styleTokens.value } : {}),
    },
  };
}

function normalizePageConfig(
  input: unknown,
  pageKey: (typeof PAGE_KEYS)[number],
): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: `pages.${pageKey} must be an object` };
  }
  if (!Array.isArray(input.sections)) {
    return { ok: false, error: `pages.${pageKey}.sections must be an array` };
  }
  if (input.sections.length > MAX_SECTIONS_PER_PAGE) {
    return {
      ok: false,
      error: `pages.${pageKey}.sections exceeds max allowed size`,
    };
  }

  const sections: AnyRecord[] = [];
  for (let i = 0; i < input.sections.length; i += 1) {
    const section = normalizeSection(input.sections[i], i);
    if (!section.ok) {
      return { ok: false, error: `pages.${pageKey}.${section.error}` };
    }
    sections.push(section.value);
  }

  return { ok: true, value: { sections } };
}

function parseRawSiteConfig(input: unknown): ParseResult<AnyRecord | null> {
  if (input === null) {
    return { ok: true, value: null };
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: false, error: 'siteConfig must not be empty' };
    }
    if (trimmed.length > MAX_SITE_CONFIG_BYTES) {
      return { ok: false, error: 'siteConfig payload is too large' };
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed === null) return { ok: true, value: null };
      if (!isRecord(parsed)) {
        return { ok: false, error: 'siteConfig must be an object' };
      }
      return { ok: true, value: parsed };
    } catch {
      return { ok: false, error: 'siteConfig must be valid JSON' };
    }
  }

  if (!isRecord(input)) {
    return { ok: false, error: 'siteConfig must be an object' };
  }
  return { ok: true, value: input };
}

export function normalizeVendorSiteConfigInput(
  rawInput: unknown,
): ParseResult<AnyRecord | null> {
  const root = parseRawSiteConfig(rawInput);
  if (!root.ok) return root;
  if (root.value === null) return root;

  const version = root.value.version;
  if (version !== 1) {
    return { ok: false, error: 'siteConfig.version must be 1' };
  }

  let theme: AnyRecord | undefined;
  if (root.value.theme !== undefined && root.value.theme !== null) {
    if (!isRecord(root.value.theme)) {
      return { ok: false, error: 'siteConfig.theme must be an object' };
    }
    const componentsRaw = root.value.theme.components;
    if (componentsRaw !== undefined && componentsRaw !== null) {
      if (!isRecord(componentsRaw)) {
        return {
          ok: false,
          error: 'siteConfig.theme.components must be an object',
        };
      }
      const components: AnyRecord = {};
      for (const [key, value] of Object.entries(componentsRaw)) {
        if (!THEME_COMPONENT_KEYS.includes(key as (typeof THEME_COMPONENT_KEYS)[number])) {
          return {
            ok: false,
            error: `siteConfig.theme.components.${key} is not supported`,
          };
        }
        const tokens = normalizeStyleTokens(
          value,
          `siteConfig.theme.components.${key}`,
        );
        if (!tokens.ok) return tokens;
        components[key] = tokens.value ?? {};
      }
      theme = { components };
    } else {
      theme = {};
    }
  }

  if (!isRecord(root.value.pages)) {
    return { ok: false, error: 'siteConfig.pages must be an object' };
  }

  const pages: AnyRecord = {};
  for (const key of PAGE_KEYS) {
    const normalizedPage = normalizePageConfig(root.value.pages[key], key);
    if (!normalizedPage.ok) return normalizedPage;
    pages[key] = normalizedPage.value;
  }

  const normalized = {
    version: 1,
    ...(theme ? { theme } : {}),
    pages,
  };

  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SITE_CONFIG_BYTES) {
    return { ok: false, error: 'siteConfig payload is too large' };
  }

  return { ok: true, value: normalized };
}
