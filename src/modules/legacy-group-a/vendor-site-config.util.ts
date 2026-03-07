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
const THEME_NAVIGATION_VARIANTS = new Set(['floating', 'fullWidth']);
const THEME_NAVIGATION_POSITIONS = new Set(['top', 'bottom']);
const THEME_NAVIGATION_MOBILE_MENU_MODES = new Set(['fullscreen']);
const THEME_NAVIGATION_MOBILE_MENU_MOTIONS = new Set(['left']);
const HERO_VARIANTS = new Set(['inset', 'fullWidth']);
const HERO_CONTENT_ALIGNS = new Set(['left', 'center']);
const HERO_BACKGROUND_MODES = new Set(['solid', 'gradient', 'image']);
const MEDIA_TEXT_ALIGNS = new Set(['left', 'center']);
const TESTIMONIALS_VARIANTS = new Set(['grid', 'carousel']);
const RICH_TEXT_TEXT_DECORATIONS = new Set([
  'none',
  'underline',
  'line-through',
  'overline',
]);
const ALLOWED_STYLE_TOKEN_KEYS = new Set([
  '--builder-bg',
  '--builder-surface',
  '--builder-text',
  '--builder-muted-text',
  '--builder-border',
  '--builder-accent',
  '--builder-accent-contrast',
  '--builder-media-image-height-desktop',
  '--builder-media-text-align-desktop',
  '--builder-richtext-text-color',
  '--builder-richtext-text-size',
  '--builder-richtext-text-weight',
  '--builder-richtext-text-decoration',
  '--builder-richtext-surface',
  '--builder-richtext-border-color',
  '--builder-richtext-border-width',
  '--builder-richtext-padding',
  '--builder-richtext-margin',
  '--builder-testimonials-quote-color',
  '--builder-testimonials-quote-size',
  '--builder-testimonials-quote-weight',
  '--builder-testimonials-quote-decoration',
  '--builder-testimonials-meta-color',
  '--builder-testimonials-meta-size',
  '--builder-testimonials-meta-weight',
  '--builder-testimonials-meta-decoration',
  '--builder-footer-brand-color',
  '--builder-footer-brand-size',
  '--builder-footer-brand-weight',
  '--builder-footer-brand-decoration',
  '--builder-footer-description-color',
  '--builder-footer-description-size',
  '--builder-footer-description-weight',
  '--builder-footer-description-decoration',
  '--builder-footer-group-title-color',
  '--builder-footer-group-title-size',
  '--builder-footer-group-title-weight',
  '--builder-footer-group-title-decoration',
  '--builder-footer-link-color',
  '--builder-footer-link-size',
  '--builder-footer-link-weight',
  '--builder-footer-link-decoration',
  '--builder-footer-social-color',
  '--builder-footer-social-size',
  '--builder-footer-social-weight',
  '--builder-footer-social-decoration',
  '--builder-footer-copyright-color',
  '--builder-footer-copyright-size',
  '--builder-footer-copyright-weight',
  '--builder-footer-copyright-decoration',
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
const DEFAULT_HERO_GRADIENT_ANGLE = 135;
const LEGACY_HERO_OVERLAY_COLOR = '#000000';
const LEGACY_HERO_OVERLAY_OPACITY = 0.35;
const MEDIA_TEXT_IMAGE_HEIGHT_MIN = 180;
const MEDIA_TEXT_IMAGE_HEIGHT_MAX = 900;
const MEDIA_TEXT_DESKTOP_IMAGE_HEIGHT_TOKEN = '--builder-media-image-height-desktop';
const MEDIA_TEXT_DESKTOP_TEXT_ALIGN_TOKEN = '--builder-media-text-align-desktop';
const RICH_TEXT_TEXT_SIZE_MIN = 12;
const RICH_TEXT_TEXT_SIZE_MAX = 48;
const RICH_TEXT_BORDER_WIDTH_MIN = 0;
const RICH_TEXT_BORDER_WIDTH_MAX = 8;
const RICH_TEXT_SPACING_MIN = 0;
const RICH_TEXT_SPACING_MAX = 120;
const RICH_TEXT_TEXT_COLOR_TOKEN = '--builder-richtext-text-color';
const RICH_TEXT_TEXT_SIZE_TOKEN = '--builder-richtext-text-size';
const RICH_TEXT_TEXT_WEIGHT_TOKEN = '--builder-richtext-text-weight';
const RICH_TEXT_TEXT_DECORATION_TOKEN = '--builder-richtext-text-decoration';
const RICH_TEXT_SURFACE_TOKEN = '--builder-richtext-surface';
const RICH_TEXT_BORDER_COLOR_TOKEN = '--builder-richtext-border-color';
const RICH_TEXT_BORDER_WIDTH_TOKEN = '--builder-richtext-border-width';
const RICH_TEXT_PADDING_TOKEN = '--builder-richtext-padding';
const RICH_TEXT_MARGIN_TOKEN = '--builder-richtext-margin';
const TESTIMONIALS_TEXT_SIZE_MIN = 12;
const TESTIMONIALS_TEXT_SIZE_MAX = 48;
const TESTIMONIALS_GRID_MAX_ITEMS = 9;
const TESTIMONIALS_QUOTE_COLOR_TOKEN = '--builder-testimonials-quote-color';
const TESTIMONIALS_QUOTE_SIZE_TOKEN = '--builder-testimonials-quote-size';
const TESTIMONIALS_QUOTE_WEIGHT_TOKEN = '--builder-testimonials-quote-weight';
const TESTIMONIALS_QUOTE_DECORATION_TOKEN = '--builder-testimonials-quote-decoration';
const TESTIMONIALS_META_COLOR_TOKEN = '--builder-testimonials-meta-color';
const TESTIMONIALS_META_SIZE_TOKEN = '--builder-testimonials-meta-size';
const TESTIMONIALS_META_WEIGHT_TOKEN = '--builder-testimonials-meta-weight';
const TESTIMONIALS_META_DECORATION_TOKEN = '--builder-testimonials-meta-decoration';
const FOOTER_TEXT_SIZE_MIN = 12;
const FOOTER_TEXT_SIZE_MAX = 48;
const FOOTER_BRAND_COLOR_TOKEN = '--builder-footer-brand-color';
const FOOTER_BRAND_SIZE_TOKEN = '--builder-footer-brand-size';
const FOOTER_BRAND_WEIGHT_TOKEN = '--builder-footer-brand-weight';
const FOOTER_BRAND_DECORATION_TOKEN = '--builder-footer-brand-decoration';
const FOOTER_DESCRIPTION_COLOR_TOKEN = '--builder-footer-description-color';
const FOOTER_DESCRIPTION_SIZE_TOKEN = '--builder-footer-description-size';
const FOOTER_DESCRIPTION_WEIGHT_TOKEN = '--builder-footer-description-weight';
const FOOTER_DESCRIPTION_DECORATION_TOKEN = '--builder-footer-description-decoration';
const FOOTER_GROUP_TITLE_COLOR_TOKEN = '--builder-footer-group-title-color';
const FOOTER_GROUP_TITLE_SIZE_TOKEN = '--builder-footer-group-title-size';
const FOOTER_GROUP_TITLE_WEIGHT_TOKEN = '--builder-footer-group-title-weight';
const FOOTER_GROUP_TITLE_DECORATION_TOKEN = '--builder-footer-group-title-decoration';
const FOOTER_LINK_COLOR_TOKEN = '--builder-footer-link-color';
const FOOTER_LINK_SIZE_TOKEN = '--builder-footer-link-size';
const FOOTER_LINK_WEIGHT_TOKEN = '--builder-footer-link-weight';
const FOOTER_LINK_DECORATION_TOKEN = '--builder-footer-link-decoration';
const FOOTER_SOCIAL_COLOR_TOKEN = '--builder-footer-social-color';
const FOOTER_SOCIAL_SIZE_TOKEN = '--builder-footer-social-size';
const FOOTER_SOCIAL_WEIGHT_TOKEN = '--builder-footer-social-weight';
const FOOTER_SOCIAL_DECORATION_TOKEN = '--builder-footer-social-decoration';
const FOOTER_COPYRIGHT_COLOR_TOKEN = '--builder-footer-copyright-color';
const FOOTER_COPYRIGHT_SIZE_TOKEN = '--builder-footer-copyright-size';
const FOOTER_COPYRIGHT_WEIGHT_TOKEN = '--builder-footer-copyright-weight';
const FOOTER_COPYRIGHT_DECORATION_TOKEN = '--builder-footer-copyright-decoration';
const IMAGE_CAROUSEL_VARIANTS = new Set(['plain', 'overlay', 'split']);
const IMAGE_CAROUSEL_SPLIT_IMAGE_POSITIONS = new Set(['left', 'right']);
const IMAGE_CAROUSEL_MAX_ITEMS = 20;
const IMAGE_CAROUSEL_OVERLAY_DEFAULT_COLOR = '#000000';
const IMAGE_CAROUSEL_OVERLAY_DEFAULT_OPACITY = 0.35;
const SECTION_LAYOUT_WRAPPERS = new Set(['section', 'sectionContent', 'none']);
const SECTION_LAYOUT_HEIGHT_MIN = 120;
const SECTION_LAYOUT_HEIGHT_MAX = 1600;

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

function isSafeColorValue(value: string): boolean {
  return isSafeCssTokenValue(value);
}

function normalizeNumber(value: unknown, path: string): ParseResult<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `${path} must be a finite number` };
  }
  return { ok: true, value };
}

function normalizeMediaTextAlign(
  value: unknown,
  path: string,
): ParseResult<'left' | 'center'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!MEDIA_TEXT_ALIGNS.has(normalized)) {
    return { ok: false, error: `${path} must be one of left or center` };
  }
  return { ok: true, value: normalized as 'left' | 'center' };
}

function normalizeImageCarouselVariant(
  value: unknown,
  path: string,
): ParseResult<'plain' | 'overlay' | 'split'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!IMAGE_CAROUSEL_VARIANTS.has(normalized)) {
    return {
      ok: false,
      error: `${path} must be one of plain, overlay or split`,
    };
  }
  return { ok: true, value: normalized as 'plain' | 'overlay' | 'split' };
}

function normalizeImageCarouselSplitImagePosition(
  value: unknown,
  path: string,
): ParseResult<'left' | 'right'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!IMAGE_CAROUSEL_SPLIT_IMAGE_POSITIONS.has(normalized)) {
    return { ok: false, error: `${path} must be one of left or right` };
  }
  return { ok: true, value: normalized as 'left' | 'right' };
}

function normalizeSectionLayoutWrapper(
  value: unknown,
  path: string,
): ParseResult<'section' | 'sectionContent' | 'none'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim();
  if (!SECTION_LAYOUT_WRAPPERS.has(normalized)) {
    return {
      ok: false,
      error: `${path} must be one of section, sectionContent or none`,
    };
  }
  return { ok: true, value: normalized as 'section' | 'sectionContent' | 'none' };
}

function normalizeSectionLayoutHeight(
  value: unknown,
  path: string,
): ParseResult<number> {
  const normalized = normalizeNumber(value, path);
  if (!normalized.ok) return normalized;
  if (
    !Number.isInteger(normalized.value)
    || normalized.value < SECTION_LAYOUT_HEIGHT_MIN
    || normalized.value > SECTION_LAYOUT_HEIGHT_MAX
  ) {
    return {
      ok: false,
      error: `${path} must be an integer between ${SECTION_LAYOUT_HEIGHT_MIN} and ${SECTION_LAYOUT_HEIGHT_MAX}`,
    };
  }
  return { ok: true, value: normalized.value };
}

function normalizeDesktopImageHeightToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,4})px$/);
  if (!match) {
    return { ok: false, error: `${path} must be in Npx format` };
  }
  const parsed = Number.parseInt(match[1], 10);
  if (
    !Number.isInteger(parsed)
    || parsed < MEDIA_TEXT_IMAGE_HEIGHT_MIN
    || parsed > MEDIA_TEXT_IMAGE_HEIGHT_MAX
  ) {
    return {
      ok: false,
      error: `${path} must be between ${MEDIA_TEXT_IMAGE_HEIGHT_MIN}px and ${MEDIA_TEXT_IMAGE_HEIGHT_MAX}px`,
    };
  }
  return { ok: true, value: `${parsed}px` };
}

function normalizePixelLengthToken(
  value: unknown,
  path: string,
  min: number,
  max: number,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,4})px$/);
  if (!match) {
    return { ok: false, error: `${path} must be in Npx format` };
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `${path} must be between ${min}px and ${max}px` };
  }
  return { ok: true, value: `${parsed}px` };
}

function normalizeRichTextWeightToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'normal' || normalized === 'bold') {
    return { ok: true, value: normalized };
  }
  if (!/^[1-9]00$/.test(normalized)) {
    return { ok: false, error: `${path} must be normal, bold, or 100..900` };
  }
  return { ok: true, value: normalized };
}

function normalizeRichTextDecorationToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!RICH_TEXT_TEXT_DECORATIONS.has(normalized)) {
    return { ok: false, error: `${path} must be one of none, underline, line-through or overline` };
  }
  return { ok: true, value: normalized };
}

function normalizeSpacingShorthandToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { ok: false, error: `${path} must not be empty` };
  }

  const parts = normalized.split(' ');
  if (parts.length < 1 || parts.length > 4) {
    return { ok: false, error: `${path} must have 1 to 4 spacing values` };
  }

  const normalizedParts: string[] = [];
  for (const part of parts) {
    if (part === '0') {
      normalizedParts.push('0px');
      continue;
    }
    const px = normalizePixelLengthToken(
      part,
      path,
      RICH_TEXT_SPACING_MIN,
      RICH_TEXT_SPACING_MAX,
    );
    if (!px.ok) return px;
    normalizedParts.push(px.value);
  }
  return { ok: true, value: normalizedParts.join(' ') };
}

function normalizeHeroBackground(
  input: unknown,
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: 'hero.data.background must be an object' };
  }

  const allowedKeys = new Set(['mode', 'solidColor', 'gradient', 'imageUrl', 'overlay']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `hero.data.background.${key} is not supported` };
    }
  }

  if (typeof input.mode !== 'string') {
    return { ok: false, error: 'hero.data.background.mode must be a string' };
  }
  const mode = input.mode.trim();
  if (!HERO_BACKGROUND_MODES.has(mode)) {
    return { ok: false, error: 'hero.data.background.mode must be one of solid, gradient or image' };
  }

  if (mode === 'solid') {
    if (typeof input.solidColor !== 'string') {
      return { ok: false, error: 'hero.data.background.solidColor must be a string' };
    }
    const solidColor = input.solidColor.trim();
    if (!solidColor || !isSafeColorValue(solidColor)) {
      return { ok: false, error: 'hero.data.background.solidColor is invalid' };
    }
    return {
      ok: true,
      value: {
        mode: 'solid',
        solidColor,
      },
    };
  }

  if (mode === 'gradient') {
    if (!isRecord(input.gradient)) {
      return { ok: false, error: 'hero.data.background.gradient must be an object' };
    }
    const gradientAllowedKeys = new Set(['from', 'to', 'angle']);
    for (const key of Object.keys(input.gradient)) {
      if (!gradientAllowedKeys.has(key)) {
        return { ok: false, error: `hero.data.background.gradient.${key} is not supported` };
      }
    }

    if (typeof input.gradient.from !== 'string') {
      return { ok: false, error: 'hero.data.background.gradient.from must be a string' };
    }
    if (typeof input.gradient.to !== 'string') {
      return { ok: false, error: 'hero.data.background.gradient.to must be a string' };
    }

    const from = input.gradient.from.trim();
    const to = input.gradient.to.trim();
    if (!from || !isSafeColorValue(from)) {
      return { ok: false, error: 'hero.data.background.gradient.from is invalid' };
    }
    if (!to || !isSafeColorValue(to)) {
      return { ok: false, error: 'hero.data.background.gradient.to is invalid' };
    }

    let angle = DEFAULT_HERO_GRADIENT_ANGLE;
    if (input.gradient.angle !== undefined && input.gradient.angle !== null) {
      const normalizedAngle = normalizeNumber(
        input.gradient.angle,
        'hero.data.background.gradient.angle',
      );
      if (!normalizedAngle.ok) return normalizedAngle;
      if (normalizedAngle.value < 0 || normalizedAngle.value > 360) {
        return {
          ok: false,
          error: 'hero.data.background.gradient.angle must be between 0 and 360',
        };
      }
      angle = normalizedAngle.value;
    }

    return {
      ok: true,
      value: {
        mode: 'gradient',
        gradient: {
          from,
          to,
          angle,
        },
      },
    };
  }

  const imageUrl = normalizeUrl(
    input.imageUrl,
    { allowRelative: false, httpsOnly: false },
    'hero.data.background.imageUrl',
  );
  if (!imageUrl.ok) return imageUrl;

  if (input.overlay !== undefined && input.overlay !== null && !isRecord(input.overlay)) {
    return { ok: false, error: 'hero.data.background.overlay must be an object' };
  }

  let overlay: AnyRecord | undefined;
  if (isRecord(input.overlay)) {
    const overlayAllowedKeys = new Set(['color', 'opacity']);
    for (const key of Object.keys(input.overlay)) {
      if (!overlayAllowedKeys.has(key)) {
        return { ok: false, error: `hero.data.background.overlay.${key} is not supported` };
      }
    }

    if (typeof input.overlay.color !== 'string') {
      return { ok: false, error: 'hero.data.background.overlay.color must be a string' };
    }
    const color = input.overlay.color.trim();
    if (!color || !isSafeColorValue(color)) {
      return { ok: false, error: 'hero.data.background.overlay.color is invalid' };
    }

    const opacity = normalizeNumber(
      input.overlay.opacity,
      'hero.data.background.overlay.opacity',
    );
    if (!opacity.ok) return opacity;
    if (opacity.value < 0 || opacity.value > 1) {
      return {
        ok: false,
        error: 'hero.data.background.overlay.opacity must be between 0 and 1',
      };
    }

    overlay = {
      color,
      opacity: opacity.value,
    };
  }

  return {
    ok: true,
    value: {
      mode: 'image',
      imageUrl: imageUrl.value,
      ...(overlay ? { overlay } : {}),
    },
  };
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
    if (key === MEDIA_TEXT_DESKTOP_IMAGE_HEIGHT_TOKEN) {
      const value = normalizeDesktopImageHeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === MEDIA_TEXT_DESKTOP_TEXT_ALIGN_TOKEN) {
      const value = normalizeMediaTextAlign(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === RICH_TEXT_TEXT_COLOR_TOKEN
      || key === RICH_TEXT_SURFACE_TOKEN
      || key === RICH_TEXT_BORDER_COLOR_TOKEN
    ) {
      if (typeof rawValue !== 'string') {
        return { ok: false, error: `${path}.${key} must be a string` };
      }
      const value = rawValue.trim();
      if (!value) {
        return { ok: false, error: `${path}.${key} must not be empty` };
      }
      if (!isSafeCssTokenValue(value)) {
        return { ok: false, error: `${path}.${key} has an invalid token value` };
      }
      normalized[key] = value;
      continue;
    }
    if (key === RICH_TEXT_TEXT_SIZE_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_TEXT_SIZE_MIN,
        RICH_TEXT_TEXT_SIZE_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_BORDER_WIDTH_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_BORDER_WIDTH_MIN,
        RICH_TEXT_BORDER_WIDTH_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_TEXT_WEIGHT_TOKEN) {
      const value = normalizeRichTextWeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_TEXT_DECORATION_TOKEN) {
      const value = normalizeRichTextDecorationToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_PADDING_TOKEN || key === RICH_TEXT_MARGIN_TOKEN) {
      const value = normalizeSpacingShorthandToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === TESTIMONIALS_QUOTE_COLOR_TOKEN
      || key === TESTIMONIALS_META_COLOR_TOKEN
    ) {
      if (typeof rawValue !== 'string') {
        return { ok: false, error: `${path}.${key} must be a string` };
      }
      const value = rawValue.trim();
      if (!value) {
        return { ok: false, error: `${path}.${key} must not be empty` };
      }
      if (!isSafeCssTokenValue(value)) {
        return { ok: false, error: `${path}.${key} has an invalid token value` };
      }
      normalized[key] = value;
      continue;
    }
    if (key === TESTIMONIALS_QUOTE_SIZE_TOKEN || key === TESTIMONIALS_META_SIZE_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        TESTIMONIALS_TEXT_SIZE_MIN,
        TESTIMONIALS_TEXT_SIZE_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === TESTIMONIALS_QUOTE_WEIGHT_TOKEN || key === TESTIMONIALS_META_WEIGHT_TOKEN) {
      const value = normalizeRichTextWeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === TESTIMONIALS_QUOTE_DECORATION_TOKEN
      || key === TESTIMONIALS_META_DECORATION_TOKEN
    ) {
      const value = normalizeRichTextDecorationToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === FOOTER_BRAND_COLOR_TOKEN
      || key === FOOTER_DESCRIPTION_COLOR_TOKEN
      || key === FOOTER_GROUP_TITLE_COLOR_TOKEN
      || key === FOOTER_LINK_COLOR_TOKEN
      || key === FOOTER_SOCIAL_COLOR_TOKEN
      || key === FOOTER_COPYRIGHT_COLOR_TOKEN
    ) {
      if (typeof rawValue !== 'string') {
        return { ok: false, error: `${path}.${key} must be a string` };
      }
      const value = rawValue.trim();
      if (!value) {
        return { ok: false, error: `${path}.${key} must not be empty` };
      }
      if (!isSafeCssTokenValue(value)) {
        return { ok: false, error: `${path}.${key} has an invalid token value` };
      }
      normalized[key] = value;
      continue;
    }
    if (
      key === FOOTER_BRAND_SIZE_TOKEN
      || key === FOOTER_DESCRIPTION_SIZE_TOKEN
      || key === FOOTER_GROUP_TITLE_SIZE_TOKEN
      || key === FOOTER_LINK_SIZE_TOKEN
      || key === FOOTER_SOCIAL_SIZE_TOKEN
      || key === FOOTER_COPYRIGHT_SIZE_TOKEN
    ) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        FOOTER_TEXT_SIZE_MIN,
        FOOTER_TEXT_SIZE_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === FOOTER_BRAND_WEIGHT_TOKEN
      || key === FOOTER_DESCRIPTION_WEIGHT_TOKEN
      || key === FOOTER_GROUP_TITLE_WEIGHT_TOKEN
      || key === FOOTER_LINK_WEIGHT_TOKEN
      || key === FOOTER_SOCIAL_WEIGHT_TOKEN
      || key === FOOTER_COPYRIGHT_WEIGHT_TOKEN
    ) {
      const value = normalizeRichTextWeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === FOOTER_BRAND_DECORATION_TOKEN
      || key === FOOTER_DESCRIPTION_DECORATION_TOKEN
      || key === FOOTER_GROUP_TITLE_DECORATION_TOKEN
      || key === FOOTER_LINK_DECORATION_TOKEN
      || key === FOOTER_SOCIAL_DECORATION_TOKEN
      || key === FOOTER_COPYRIGHT_DECORATION_TOKEN
    ) {
      const value = normalizeRichTextDecorationToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
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

function normalizeThemeNavigation(
  input: unknown,
  path: string,
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const allowedKeys = new Set(['variant', 'position', 'mobileMenu']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `${path}.${key} is not supported` };
    }
  }

  const normalized: AnyRecord = {};

  if (input.variant !== undefined && input.variant !== null) {
    if (typeof input.variant !== 'string') {
      return { ok: false, error: `${path}.variant must be a string` };
    }
    const variant = input.variant.trim();
    if (!THEME_NAVIGATION_VARIANTS.has(variant)) {
      return {
        ok: false,
        error: `${path}.variant must be one of floating or fullWidth`,
      };
    }
    normalized.variant = variant;
  }

  if (input.position !== undefined && input.position !== null) {
    if (typeof input.position !== 'string') {
      return { ok: false, error: `${path}.position must be a string` };
    }
    const position = input.position.trim();
    if (!THEME_NAVIGATION_POSITIONS.has(position)) {
      return {
        ok: false,
        error: `${path}.position must be one of top or bottom`,
      };
    }
    normalized.position = position;
  }

  if (input.mobileMenu !== undefined && input.mobileMenu !== null) {
    if (!isRecord(input.mobileMenu)) {
      return { ok: false, error: `${path}.mobileMenu must be an object` };
    }

    const allowedMobileKeys = new Set(['mode', 'motion']);
    for (const key of Object.keys(input.mobileMenu)) {
      if (!allowedMobileKeys.has(key)) {
        return { ok: false, error: `${path}.mobileMenu.${key} is not supported` };
      }
    }

    const mobileMenu: AnyRecord = {};
    if (input.mobileMenu.mode !== undefined && input.mobileMenu.mode !== null) {
      if (typeof input.mobileMenu.mode !== 'string') {
        return { ok: false, error: `${path}.mobileMenu.mode must be a string` };
      }
      const mode = input.mobileMenu.mode.trim();
      if (!THEME_NAVIGATION_MOBILE_MENU_MODES.has(mode)) {
        return {
          ok: false,
          error: `${path}.mobileMenu.mode must be fullscreen`,
        };
      }
      mobileMenu.mode = mode;
    }

    if (input.mobileMenu.motion !== undefined && input.mobileMenu.motion !== null) {
      if (typeof input.mobileMenu.motion !== 'string') {
        return { ok: false, error: `${path}.mobileMenu.motion must be a string` };
      }
      const motion = input.mobileMenu.motion.trim();
      if (!THEME_NAVIGATION_MOBILE_MENU_MOTIONS.has(motion)) {
        return {
          ok: false,
          error: `${path}.mobileMenu.motion must be left`,
        };
      }
      mobileMenu.motion = motion;
    }

    if (Object.keys(mobileMenu).length > 0) {
      normalized.mobileMenu = mobileMenu;
    }
  }

  return Object.keys(normalized).length > 0
    ? { ok: true, value: normalized }
    : { ok: true, value: undefined };
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

  const variant =
    input.variant === undefined || input.variant === null
      ? ({ ok: true, value: 'inset' } as ParseResult<string>)
      : normalizeString(input.variant, 20);
  if (!variant.ok) return { ok: false, error: `hero.data.variant ${variant.error}` };
  if (!HERO_VARIANTS.has(variant.value)) {
    return {
      ok: false,
      error: 'hero.data.variant must be one of inset or fullWidth',
    };
  }

  const contentAlign =
    input.contentAlign === undefined || input.contentAlign === null
      ? ({ ok: true, value: 'left' } as ParseResult<string>)
      : normalizeString(input.contentAlign, 20);
  if (!contentAlign.ok) {
    return { ok: false, error: `hero.data.contentAlign ${contentAlign.error}` };
  }
  if (!HERO_CONTENT_ALIGNS.has(contentAlign.value)) {
    return {
      ok: false,
      error: 'hero.data.contentAlign must be one of left or center',
    };
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

  const background = normalizeHeroBackground(input.background);
  if (!background.ok) return background;

  const normalizedBackground = background.value
    || (backgroundImageUrl.value
      ? {
        mode: 'image',
        imageUrl: backgroundImageUrl.value,
        overlay: {
          color: LEGACY_HERO_OVERLAY_COLOR,
          opacity: LEGACY_HERO_OVERLAY_OPACITY,
        },
      }
      : undefined);

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
      variant: variant.value,
      contentAlign: contentAlign.value,
      ...(subheading.value ? { subheading: subheading.value } : {}),
      ...(backgroundImageUrl.value
        ? { backgroundImageUrl: backgroundImageUrl.value }
        : {}),
      ...(normalizedBackground ? { background: normalizedBackground } : {}),
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

  const imageHeightPx =
    input.imageHeightPx === undefined || input.imageHeightPx === null
      ? ({ ok: true, value: undefined } as ParseResult<number | undefined>)
      : normalizeNumber(input.imageHeightPx, 'mediaText.data.imageHeightPx');
  if (!imageHeightPx.ok) return imageHeightPx;
  if (
    imageHeightPx.value !== undefined
    && (!Number.isInteger(imageHeightPx.value)
      || imageHeightPx.value < MEDIA_TEXT_IMAGE_HEIGHT_MIN
      || imageHeightPx.value > MEDIA_TEXT_IMAGE_HEIGHT_MAX)
  ) {
    return {
      ok: false,
      error: `mediaText.data.imageHeightPx must be an integer between ${MEDIA_TEXT_IMAGE_HEIGHT_MIN} and ${MEDIA_TEXT_IMAGE_HEIGHT_MAX}`,
    };
  }

  const textAlign =
    input.textAlign === undefined || input.textAlign === null
      ? ({ ok: true, value: undefined } as ParseResult<'left' | 'center' | undefined>)
      : normalizeMediaTextAlign(input.textAlign, 'mediaText.data.textAlign');
  if (!textAlign.ok) return textAlign;

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      mediaPosition: mediaPositionValue,
      ...(mediaUrl.value ? { mediaUrl: mediaUrl.value } : {}),
      ...(mediaAlt.value ? { mediaAlt: mediaAlt.value } : {}),
      ...(imageHeightPx.value !== undefined ? { imageHeightPx: imageHeightPx.value } : {}),
      ...(textAlign.value ? { textAlign: textAlign.value } : {}),
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

  let variant: 'grid' | 'carousel' = 'grid';
  if (input.variant !== undefined && input.variant !== null) {
    if (typeof input.variant !== 'string') {
      return { ok: false, error: 'testimonials.data.variant must be a string' };
    }
    const normalizedVariant = input.variant.trim().toLowerCase();
    if (!TESTIMONIALS_VARIANTS.has(normalizedVariant)) {
      return { ok: false, error: 'testimonials.data.variant must be one of grid or carousel' };
    }
    variant = normalizedVariant as 'grid' | 'carousel';
  }

  let itemsPerViewDesktop: 1 | 2 | 3 = 1;
  if (input.itemsPerViewDesktop !== undefined && input.itemsPerViewDesktop !== null) {
    const normalizedItemsPerViewDesktop = normalizeNumber(
      input.itemsPerViewDesktop,
      'testimonials.data.itemsPerViewDesktop',
    );
    if (!normalizedItemsPerViewDesktop.ok) {
      return normalizedItemsPerViewDesktop;
    }
    if (
      !Number.isInteger(normalizedItemsPerViewDesktop.value)
      || normalizedItemsPerViewDesktop.value < 1
      || normalizedItemsPerViewDesktop.value > 3
    ) {
      return {
        ok: false,
        error: 'testimonials.data.itemsPerViewDesktop must be an integer between 1 and 3',
      };
    }
    itemsPerViewDesktop = normalizedItemsPerViewDesktop.value as 1 | 2 | 3;
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

  const normalizedItems = variant === 'grid'
    ? items.slice(0, TESTIMONIALS_GRID_MAX_ITEMS)
    : items;

  return {
    ok: true,
    value: {
      variant,
      itemsPerViewDesktop,
      items: normalizedItems,
    },
  };
}

function normalizeImageCarouselCta(
  input: unknown,
  path: string,
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const allowedKeys = new Set(['label', 'url']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `${path}.${key} is not supported` };
    }
  }

  const label = normalizeString(input.label, MAX_SHORT_TEXT_LENGTH);
  if (!label.ok) {
    return { ok: false, error: `${path}.label ${label.error}` };
  }

  const url = normalizeUrl(
    input.url,
    { allowRelative: true, httpsOnly: false },
    `${path}.url`,
  );
  if (!url.ok) {
    return { ok: false, error: url.error };
  }

  return {
    ok: true,
    value: {
      label: label.value,
      url: url.value,
    },
  };
}

function normalizeImageCarouselOverlay(
  input: unknown,
  path: string,
  opts?: { applyDefaultWhenMissing?: boolean },
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    if (opts?.applyDefaultWhenMissing) {
      return {
        ok: true,
        value: {
          color: IMAGE_CAROUSEL_OVERLAY_DEFAULT_COLOR,
          opacity: IMAGE_CAROUSEL_OVERLAY_DEFAULT_OPACITY,
        },
      };
    }
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const allowedKeys = new Set(['color', 'opacity']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `${path}.${key} is not supported` };
    }
  }

  if (typeof input.color !== 'string') {
    return { ok: false, error: `${path}.color must be a string` };
  }
  const color = input.color.trim();
  if (!color || !isSafeColorValue(color)) {
    return { ok: false, error: `${path}.color is invalid` };
  }

  const opacity = normalizeNumber(input.opacity, `${path}.opacity`);
  if (!opacity.ok) return opacity;
  if (opacity.value < 0 || opacity.value > 1) {
    return {
      ok: false,
      error: `${path}.opacity must be between 0 and 1`,
    };
  }

  return {
    ok: true,
    value: {
      color,
      opacity: opacity.value,
    },
  };
}

function normalizeImageCarouselSlide(
  input: unknown,
  index: number,
): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: `imageCarousel.data.slides[${index}] must be an object`,
    };
  }

  const variant = normalizeImageCarouselVariant(
    input.variant,
    `imageCarousel.data.slides[${index}].variant`,
  );
  if (!variant.ok) return variant;

  const imageUrl = normalizeUrl(
    input.imageUrl,
    { allowRelative: false, httpsOnly: false },
    `imageCarousel.data.slides[${index}].imageUrl`,
  );
  if (!imageUrl.ok) return imageUrl;

  const imageAlt = normalizeOptionalString(
    input.imageAlt,
    MAX_SHORT_TEXT_LENGTH,
  );
  if (!imageAlt.ok) {
    return {
      ok: false,
      error: `imageCarousel.data.slides[${index}].imageAlt ${imageAlt.error}`,
    };
  }

  const normalized: AnyRecord = {
    variant: variant.value,
    imageUrl: imageUrl.value,
    ...(imageAlt.value ? { imageAlt: imageAlt.value } : {}),
  };

  if (variant.value === 'plain') {
    return { ok: true, value: normalized };
  }

  const title = normalizeString(input.title, MAX_SHORT_TEXT_LENGTH);
  if (!title.ok) {
    return {
      ok: false,
      error: `imageCarousel.data.slides[${index}].title ${title.error}`,
    };
  }
  const description = normalizeString(input.description, MAX_MEDIUM_TEXT_LENGTH);
  if (!description.ok) {
    return {
      ok: false,
      error: `imageCarousel.data.slides[${index}].description ${description.error}`,
    };
  }
  normalized.title = title.value;
  normalized.description = description.value;

  const cta = normalizeImageCarouselCta(
    input.cta,
    `imageCarousel.data.slides[${index}].cta`,
  );
  if (!cta.ok) return cta;
  if (cta.value) {
    normalized.cta = cta.value;
  }

  if (variant.value === 'overlay') {
    const overlay = normalizeImageCarouselOverlay(
      input.overlay,
      `imageCarousel.data.slides[${index}].overlay`,
      { applyDefaultWhenMissing: true },
    );
    if (!overlay.ok) return overlay;
    if (overlay.value) {
      normalized.overlay = overlay.value;
    }
    return { ok: true, value: normalized };
  }

  const imagePosition = normalizeImageCarouselSplitImagePosition(
    input.imagePosition,
    `imageCarousel.data.slides[${index}].imagePosition`,
  );
  if (!imagePosition.ok) return imagePosition;
  normalized.imagePosition = imagePosition.value;

  return { ok: true, value: normalized };
}

function normalizeImageCarouselSlides(
  input: unknown,
): ParseResult<AnyRecord[] | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(input)) {
    return { ok: false, error: 'imageCarousel.data.slides must be an array' };
  }
  if (input.length === 0) {
    return { ok: false, error: 'imageCarousel.data.slides must be a non-empty array' };
  }
  if (input.length > IMAGE_CAROUSEL_MAX_ITEMS) {
    return { ok: false, error: 'imageCarousel.data.slides exceeds max allowed size' };
  }

  const slides: AnyRecord[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const slide = normalizeImageCarouselSlide(input[i], i);
    if (!slide.ok) return slide;
    slides.push(slide.value);
  }

  return { ok: true, value: slides };
}

function normalizeImageCarouselLegacyImages(
  input: unknown,
): ParseResult<AnyRecord[] | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(input)) {
    return { ok: false, error: 'imageCarousel.data.images must be an array' };
  }
  if (input.length === 0) {
    return { ok: false, error: 'imageCarousel.data.images must be a non-empty array' };
  }
  if (input.length > IMAGE_CAROUSEL_MAX_ITEMS) {
    return { ok: false, error: 'imageCarousel.data.images exceeds max allowed size' };
  }

  const images: AnyRecord[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const image = input[i];
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

  return { ok: true, value: images };
}

function normalizeImageCarouselData(input: unknown): ParseResult<AnyRecord> {
  if (!isRecord(input)) {
    return { ok: false, error: 'imageCarousel.data must be an object' };
  }

  const slides = normalizeImageCarouselSlides(input.slides);
  if (!slides.ok) return slides;

  const images = normalizeImageCarouselLegacyImages(input.images);
  if (!images.ok) return images;

  if (!slides.value && !images.value) {
    return { ok: false, error: 'imageCarousel.data must include slides or images' };
  }

  return {
    ok: true,
    value: {
      ...(slides.value ? { slides: slides.value } : {}),
      ...(images.value ? { images: images.value } : {}),
    },
  };
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

function normalizeSectionLayout(
  input: unknown,
  path: string,
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const allowedKeys = new Set(['wrapper', 'minHeightPx', 'heightPx']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `${path}.${key} is not supported` };
    }
  }

  let wrapper: 'section' | 'sectionContent' | 'none' | undefined;
  if (input.wrapper !== undefined && input.wrapper !== null) {
    const normalizedWrapper = normalizeSectionLayoutWrapper(
      input.wrapper,
      `${path}.wrapper`,
    );
    if (!normalizedWrapper.ok) return normalizedWrapper;
    wrapper = normalizedWrapper.value;
  }

  let minHeightPx: number | undefined;
  if (input.minHeightPx !== undefined && input.minHeightPx !== null) {
    const normalizedMinHeight = normalizeSectionLayoutHeight(
      input.minHeightPx,
      `${path}.minHeightPx`,
    );
    if (!normalizedMinHeight.ok) return normalizedMinHeight;
    minHeightPx = normalizedMinHeight.value;
  }

  let heightPx: number | undefined;
  if (input.heightPx !== undefined && input.heightPx !== null) {
    const normalizedHeight = normalizeSectionLayoutHeight(
      input.heightPx,
      `${path}.heightPx`,
    );
    if (!normalizedHeight.ok) return normalizedHeight;
    heightPx = normalizedHeight.value;
  }

  if (minHeightPx !== undefined && heightPx !== undefined && heightPx < minHeightPx) {
    return {
      ok: false,
      error: `${path}.heightPx must be greater than or equal to ${path}.minHeightPx`,
    };
  }

  const layout: AnyRecord = {
    ...(wrapper ? { wrapper } : {}),
    ...(minHeightPx !== undefined ? { minHeightPx } : {}),
    ...(heightPx !== undefined ? { heightPx } : {}),
  };

  return Object.keys(layout).length > 0
    ? { ok: true, value: layout }
    : { ok: true, value: undefined };
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
  const layout = normalizeSectionLayout(
    section.layout,
    `sections[${index}].layout`,
  );
  if (!layout.ok) return layout;

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
      ...(layout.value ? { layout: layout.value } : {}),
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

    const navigation = normalizeThemeNavigation(
      root.value.theme.navigation,
      'siteConfig.theme.navigation',
    );
    if (!navigation.ok) {
      return navigation;
    }

    const themeData: AnyRecord = {};
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
      themeData.components = components;
    }

    if (navigation.value) {
      themeData.navigation = navigation.value;
    }

    theme = themeData;
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
