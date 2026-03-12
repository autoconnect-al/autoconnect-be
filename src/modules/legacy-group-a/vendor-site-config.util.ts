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
const HERO_IMAGE_FITS = new Set(['cover', 'contain', 'auto']);
const HERO_IMAGE_POSITION_X = new Set(['left', 'center', 'right']);
const HERO_IMAGE_POSITION_Y = new Set(['top', 'center', 'bottom']);
const HERO_IMAGE_REPEATS = new Set(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']);
const MEDIA_TEXT_ALIGNS = new Set(['left', 'center']);
const MEDIA_TEXT_IMAGE_FITS = new Set(['cover', 'contain', 'auto']);
const MEDIA_TEXT_IMAGE_POSITION_X = new Set(['left', 'center', 'right']);
const MEDIA_TEXT_IMAGE_POSITION_Y = new Set(['top', 'center', 'bottom']);
const MEDIA_TEXT_DESKTOP_FROM_BREAKPOINTS = new Set(['sm', 'md', 'lg', 'xl']);
const TESTIMONIALS_VARIANTS = new Set(['grid', 'carousel']);
const RICH_TEXT_TEXT_DECORATIONS = new Set([
  'none',
  'underline',
  'line-through',
  'overline',
]);
const TEXT_STYLE_VALUES = new Set(['normal', 'italic', 'oblique']);
const ALLOWED_STYLE_TOKEN_KEYS = new Set([
  '--builder-bg',
  '--builder-surface',
  '--builder-text',
  '--builder-muted-text',
  '--builder-border',
  '--builder-accent',
  '--builder-accent-contrast',
  '--builder-radius-base',
  '--builder-media-image-height-desktop',
  '--builder-media-text-align-desktop',
  '--builder-richtext-text-color',
  '--builder-richtext-text-size',
  '--builder-richtext-text-weight',
  '--builder-richtext-text-decoration',
  '--builder-richtext-surface',
  '--builder-richtext-accent-bar-color',
  '--builder-richtext-accent-bar-size',
  '--builder-richtext-shadow-offset-x',
  '--builder-richtext-shadow-offset-y',
  '--builder-richtext-shadow-blur',
  '--builder-richtext-shadow-spread',
  '--builder-richtext-shadow-color',
  '--builder-richtext-border-color',
  '--builder-richtext-border-width',
  '--builder-richtext-padding',
  '--builder-richtext-margin',
  '--builder-testimonials-card-bg',
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
  '--builder-nav-bg',
  '--builder-nav-mobile-panel-bg',
  '--builder-nav-mobile-backdrop-bg',
  '--builder-nav-border-color',
  '--builder-nav-border-width',
  '--builder-nav-border-radius',
  '--builder-nav-button-bg',
  '--builder-nav-button-text',
  '--builder-nav-button-active-bg',
  '--builder-nav-button-active-text',
  '--builder-nav-desktop-button-bg',
  '--builder-nav-desktop-button-text',
  '--builder-nav-desktop-button-active-bg',
  '--builder-nav-desktop-button-active-text',
  '--builder-nav-desktop-button-border-color',
  '--builder-nav-desktop-button-border-width',
  '--builder-nav-desktop-button-border-radius',
  '--builder-nav-mobile-button-bg',
  '--builder-nav-mobile-button-text',
  '--builder-nav-mobile-button-active-bg',
  '--builder-nav-mobile-button-active-text',
  '--builder-nav-mobile-button-border-color',
  '--builder-nav-mobile-button-border-width',
  '--builder-nav-mobile-button-border-radius',
  '--builder-nav-text-color',
  '--builder-nav-text-size',
  '--builder-nav-text-weight',
  '--builder-nav-text-style',
  '--builder-nav-text-decoration',
  '--builder-nav-brand-color',
  '--builder-nav-brand-size',
  '--builder-nav-brand-weight',
  '--builder-nav-brand-style',
  '--builder-nav-brand-decoration',
  '--builder-hero-title-color',
  '--builder-hero-title-size',
  '--builder-hero-title-weight',
  '--builder-hero-title-style',
  '--builder-hero-title-decoration',
  '--builder-hero-subtitle-color',
  '--builder-hero-subtitle-size',
  '--builder-hero-subtitle-weight',
  '--builder-hero-subtitle-style',
  '--builder-hero-subtitle-decoration',
  '--builder-hero-cta-color',
  '--builder-hero-cta-size',
  '--builder-hero-cta-weight',
  '--builder-hero-cta-style',
  '--builder-hero-cta-decoration',
  '--builder-hero-inner-radius',
]);
const GLOBAL_THEME_STYLE_TOKEN_KEYS = new Set([
  '--builder-bg',
  '--builder-surface',
  '--builder-text',
  '--builder-muted-text',
  '--builder-border',
  '--builder-accent',
  '--builder-accent-contrast',
  '--builder-radius-base',
]);
const NAVIGATION_STYLE_TOKEN_KEYS = new Set([
  '--builder-nav-bg',
  '--builder-nav-mobile-panel-bg',
  '--builder-nav-mobile-backdrop-bg',
  '--builder-nav-border-color',
  '--builder-nav-border-width',
  '--builder-nav-border-radius',
  '--builder-nav-button-bg',
  '--builder-nav-button-text',
  '--builder-nav-button-active-bg',
  '--builder-nav-button-active-text',
  '--builder-nav-desktop-button-bg',
  '--builder-nav-desktop-button-text',
  '--builder-nav-desktop-button-active-bg',
  '--builder-nav-desktop-button-active-text',
  '--builder-nav-desktop-button-border-color',
  '--builder-nav-desktop-button-border-width',
  '--builder-nav-desktop-button-border-radius',
  '--builder-nav-mobile-button-bg',
  '--builder-nav-mobile-button-text',
  '--builder-nav-mobile-button-active-bg',
  '--builder-nav-mobile-button-active-text',
  '--builder-nav-mobile-button-border-color',
  '--builder-nav-mobile-button-border-width',
  '--builder-nav-mobile-button-border-radius',
  '--builder-nav-text-color',
  '--builder-nav-text-size',
  '--builder-nav-text-weight',
  '--builder-nav-text-style',
  '--builder-nav-text-decoration',
  '--builder-nav-brand-color',
  '--builder-nav-brand-size',
  '--builder-nav-brand-weight',
  '--builder-nav-brand-style',
  '--builder-nav-brand-decoration',
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
const DEFAULT_HERO_IMAGE_FIT = 'cover';
const DEFAULT_HERO_IMAGE_POSITION_X = 'center';
const DEFAULT_HERO_IMAGE_POSITION_Y = 'center';
const DEFAULT_HERO_IMAGE_REPEAT = 'no-repeat';
const MEDIA_TEXT_IMAGE_HEIGHT_MIN = 80;
const MEDIA_TEXT_IMAGE_HEIGHT_MAX = 2000;
const MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MIN = 20;
const MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MAX = 80;
const MEDIA_TEXT_DEFAULT_DESKTOP_FROM_BREAKPOINT = 'md';
const MEDIA_TEXT_DESKTOP_IMAGE_HEIGHT_TOKEN = '--builder-media-image-height-desktop';
const MEDIA_TEXT_DESKTOP_TEXT_ALIGN_TOKEN = '--builder-media-text-align-desktop';
const RICH_TEXT_BORDER_WIDTH_MIN = 0;
const RICH_TEXT_BORDER_WIDTH_MAX = 8;
const RICH_TEXT_SPACING_MIN = 0;
const RICH_TEXT_SPACING_MAX = 120;
const RICH_TEXT_TEXT_COLOR_TOKEN = '--builder-richtext-text-color';
const RICH_TEXT_TEXT_SIZE_TOKEN = '--builder-richtext-text-size';
const RICH_TEXT_TEXT_WEIGHT_TOKEN = '--builder-richtext-text-weight';
const RICH_TEXT_TEXT_DECORATION_TOKEN = '--builder-richtext-text-decoration';
const RICH_TEXT_SURFACE_TOKEN = '--builder-richtext-surface';
const RICH_TEXT_ACCENT_BAR_SIZE_TOKEN = '--builder-richtext-accent-bar-size';
const RICH_TEXT_SHADOW_OFFSET_X_TOKEN = '--builder-richtext-shadow-offset-x';
const RICH_TEXT_SHADOW_OFFSET_Y_TOKEN = '--builder-richtext-shadow-offset-y';
const RICH_TEXT_SHADOW_BLUR_TOKEN = '--builder-richtext-shadow-blur';
const RICH_TEXT_SHADOW_SPREAD_TOKEN = '--builder-richtext-shadow-spread';
const RICH_TEXT_SHADOW_COLOR_TOKEN = '--builder-richtext-shadow-color';
const RICH_TEXT_ACCENT_BAR_SIZE_MIN = 0;
const RICH_TEXT_ACCENT_BAR_SIZE_MAX = 80;
const RICH_TEXT_SHADOW_OFFSET_MIN = -400;
const RICH_TEXT_SHADOW_OFFSET_MAX = 400;
const RICH_TEXT_SHADOW_BLUR_MIN = 0;
const RICH_TEXT_SHADOW_BLUR_MAX = 500;
const RICH_TEXT_SHADOW_SPREAD_MIN = -400;
const RICH_TEXT_SHADOW_SPREAD_MAX = 500;
const RICH_TEXT_BORDER_COLOR_TOKEN = '--builder-richtext-border-color';
const RICH_TEXT_BORDER_WIDTH_TOKEN = '--builder-richtext-border-width';
const RICH_TEXT_PADDING_TOKEN = '--builder-richtext-padding';
const RICH_TEXT_MARGIN_TOKEN = '--builder-richtext-margin';
const TESTIMONIALS_GRID_MAX_ITEMS = 9;
const TESTIMONIALS_QUOTE_COLOR_TOKEN = '--builder-testimonials-quote-color';
const TESTIMONIALS_QUOTE_SIZE_TOKEN = '--builder-testimonials-quote-size';
const TESTIMONIALS_QUOTE_WEIGHT_TOKEN = '--builder-testimonials-quote-weight';
const TESTIMONIALS_QUOTE_DECORATION_TOKEN = '--builder-testimonials-quote-decoration';
const TESTIMONIALS_META_COLOR_TOKEN = '--builder-testimonials-meta-color';
const TESTIMONIALS_META_SIZE_TOKEN = '--builder-testimonials-meta-size';
const TESTIMONIALS_META_WEIGHT_TOKEN = '--builder-testimonials-meta-weight';
const TESTIMONIALS_META_DECORATION_TOKEN = '--builder-testimonials-meta-decoration';
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
const GLOBAL_RADIUS_BASE_TOKEN = '--builder-radius-base';
const GLOBAL_RADIUS_BASE_MIN = 0;
const GLOBAL_RADIUS_BASE_MAX = 300;
const TESTIMONIALS_CARD_BG_TOKEN = '--builder-testimonials-card-bg';
const RICH_TEXT_ACCENT_BAR_COLOR_TOKEN = '--builder-richtext-accent-bar-color';
const NAV_BORDER_WIDTH_MIN = 0;
const NAV_BORDER_WIDTH_MAX = 12;
const NAV_BORDER_RADIUS_MIN = 0;
const NAV_BORDER_RADIUS_MAX = 300;
const NAV_BG_TOKEN = '--builder-nav-bg';
const NAV_MOBILE_PANEL_BG_TOKEN = '--builder-nav-mobile-panel-bg';
const NAV_MOBILE_BACKDROP_BG_TOKEN = '--builder-nav-mobile-backdrop-bg';
const NAV_BORDER_COLOR_TOKEN = '--builder-nav-border-color';
const NAV_BORDER_WIDTH_TOKEN = '--builder-nav-border-width';
const NAV_BORDER_RADIUS_TOKEN = '--builder-nav-border-radius';
const NAV_BUTTON_BG_TOKEN = '--builder-nav-button-bg';
const NAV_BUTTON_TEXT_TOKEN = '--builder-nav-button-text';
const NAV_BUTTON_ACTIVE_BG_TOKEN = '--builder-nav-button-active-bg';
const NAV_BUTTON_ACTIVE_TEXT_TOKEN = '--builder-nav-button-active-text';
const NAV_DESKTOP_BUTTON_BG_TOKEN = '--builder-nav-desktop-button-bg';
const NAV_DESKTOP_BUTTON_TEXT_TOKEN = '--builder-nav-desktop-button-text';
const NAV_DESKTOP_BUTTON_ACTIVE_BG_TOKEN = '--builder-nav-desktop-button-active-bg';
const NAV_DESKTOP_BUTTON_ACTIVE_TEXT_TOKEN = '--builder-nav-desktop-button-active-text';
const NAV_DESKTOP_BUTTON_BORDER_COLOR_TOKEN = '--builder-nav-desktop-button-border-color';
const NAV_DESKTOP_BUTTON_BORDER_WIDTH_TOKEN = '--builder-nav-desktop-button-border-width';
const NAV_DESKTOP_BUTTON_BORDER_RADIUS_TOKEN = '--builder-nav-desktop-button-border-radius';
const NAV_MOBILE_BUTTON_BG_TOKEN = '--builder-nav-mobile-button-bg';
const NAV_MOBILE_BUTTON_TEXT_TOKEN = '--builder-nav-mobile-button-text';
const NAV_MOBILE_BUTTON_ACTIVE_BG_TOKEN = '--builder-nav-mobile-button-active-bg';
const NAV_MOBILE_BUTTON_ACTIVE_TEXT_TOKEN = '--builder-nav-mobile-button-active-text';
const NAV_MOBILE_BUTTON_BORDER_COLOR_TOKEN = '--builder-nav-mobile-button-border-color';
const NAV_MOBILE_BUTTON_BORDER_WIDTH_TOKEN = '--builder-nav-mobile-button-border-width';
const NAV_MOBILE_BUTTON_BORDER_RADIUS_TOKEN = '--builder-nav-mobile-button-border-radius';
const NAV_TEXT_COLOR_TOKEN = '--builder-nav-text-color';
const NAV_TEXT_SIZE_TOKEN = '--builder-nav-text-size';
const NAV_TEXT_WEIGHT_TOKEN = '--builder-nav-text-weight';
const NAV_TEXT_STYLE_TOKEN = '--builder-nav-text-style';
const NAV_TEXT_DECORATION_TOKEN = '--builder-nav-text-decoration';
const NAV_BRAND_COLOR_TOKEN = '--builder-nav-brand-color';
const NAV_BRAND_SIZE_TOKEN = '--builder-nav-brand-size';
const NAV_BRAND_WEIGHT_TOKEN = '--builder-nav-brand-weight';
const NAV_BRAND_STYLE_TOKEN = '--builder-nav-brand-style';
const NAV_BRAND_DECORATION_TOKEN = '--builder-nav-brand-decoration';
const HERO_TITLE_COLOR_TOKEN = '--builder-hero-title-color';
const HERO_TITLE_SIZE_TOKEN = '--builder-hero-title-size';
const HERO_TITLE_WEIGHT_TOKEN = '--builder-hero-title-weight';
const HERO_TITLE_STYLE_TOKEN = '--builder-hero-title-style';
const HERO_TITLE_DECORATION_TOKEN = '--builder-hero-title-decoration';
const HERO_SUBTITLE_COLOR_TOKEN = '--builder-hero-subtitle-color';
const HERO_SUBTITLE_SIZE_TOKEN = '--builder-hero-subtitle-size';
const HERO_SUBTITLE_WEIGHT_TOKEN = '--builder-hero-subtitle-weight';
const HERO_SUBTITLE_STYLE_TOKEN = '--builder-hero-subtitle-style';
const HERO_SUBTITLE_DECORATION_TOKEN = '--builder-hero-subtitle-decoration';
const HERO_CTA_COLOR_TOKEN = '--builder-hero-cta-color';
const HERO_CTA_SIZE_TOKEN = '--builder-hero-cta-size';
const HERO_CTA_WEIGHT_TOKEN = '--builder-hero-cta-weight';
const HERO_CTA_STYLE_TOKEN = '--builder-hero-cta-style';
const HERO_CTA_DECORATION_TOKEN = '--builder-hero-cta-decoration';
const HERO_INNER_RADIUS_TOKEN = '--builder-hero-inner-radius';
const HERO_INNER_RADIUS_MIN = 0;
const HERO_INNER_RADIUS_MAX = 300;
const HERO_TEXT_COLOR_TOKENS = new Set([
  HERO_TITLE_COLOR_TOKEN,
  HERO_SUBTITLE_COLOR_TOKEN,
  HERO_CTA_COLOR_TOKEN,
]);
const HERO_TEXT_SIZE_TOKENS = new Set([
  HERO_TITLE_SIZE_TOKEN,
  HERO_SUBTITLE_SIZE_TOKEN,
  HERO_CTA_SIZE_TOKEN,
]);
const HERO_TEXT_WEIGHT_TOKENS = new Set([
  HERO_TITLE_WEIGHT_TOKEN,
  HERO_SUBTITLE_WEIGHT_TOKEN,
  HERO_CTA_WEIGHT_TOKEN,
]);
const HERO_TEXT_STYLE_TOKENS = new Set([
  HERO_TITLE_STYLE_TOKEN,
  HERO_SUBTITLE_STYLE_TOKEN,
  HERO_CTA_STYLE_TOKEN,
]);
const HERO_TEXT_DECORATION_TOKENS = new Set([
  HERO_TITLE_DECORATION_TOKEN,
  HERO_SUBTITLE_DECORATION_TOKEN,
  HERO_CTA_DECORATION_TOKEN,
]);
const IMAGE_CAROUSEL_VARIANTS = new Set(['plain', 'overlay', 'split']);
const IMAGE_CAROUSEL_SPLIT_IMAGE_POSITIONS = new Set(['left', 'right']);
const IMAGE_CAROUSEL_TEXT_POSITIONS_X = new Set(['left', 'center', 'right']);
const IMAGE_CAROUSEL_TEXT_POSITIONS_Y = new Set(['top', 'center', 'bottom']);
const IMAGE_CAROUSEL_TEXT_ALIGNS = new Set(['left', 'center', 'right']);
const IMAGE_CAROUSEL_MAX_ITEMS = 20;
const IMAGE_CAROUSEL_OVERLAY_DEFAULT_COLOR = '#000000';
const IMAGE_CAROUSEL_OVERLAY_DEFAULT_OPACITY = 0.35;
const SECTION_LAYOUT_WRAPPERS = new Set(['section', 'sectionContent', 'none']);
const SECTION_LAYOUT_HEIGHT_MIN = 120;
const SECTION_LAYOUT_HEIGHT_MAX = 1600;
const SECTION_LAYOUT_MARGIN_MIN = 0;
const SECTION_LAYOUT_MARGIN_MAX = 240;
const SECTION_LAYOUT_BORDER_WIDTH_MIN = 0;
const SECTION_LAYOUT_BORDER_WIDTH_MAX = 24;
const SECTION_LAYOUT_BORDER_RADIUS_MIN = 0;
const SECTION_LAYOUT_BORDER_RADIUS_MAX = 300;
const TEXT_SIZE_TOKEN_PATTERN = /^(\d+(?:\.\d+)?)(px|em|rem)$/i;
const MAP_PROVIDER_EMBED_ERROR = 'map.data.embedUrl must be an embeddable Google Maps or OpenStreetMap URL';
const MAP_GOOGLE_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.al',
  'www.google.al',
  'google.co.uk',
  'www.google.co.uk',
]);
const MAP_OSM_HOSTS = new Set([
  'openstreetmap.org',
  'www.openstreetmap.org',
]);

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

function normalizeBoolean(value: unknown, path: string): ParseResult<boolean> {
  if (typeof value !== 'boolean') {
    return { ok: false, error: `${path} must be a boolean` };
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

function normalizeMediaTextImageFit(
  value: unknown,
  path: string,
): ParseResult<'cover' | 'contain' | 'auto'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!MEDIA_TEXT_IMAGE_FITS.has(normalized)) {
    return { ok: false, error: `${path} must be one of cover, contain or auto` };
  }
  return { ok: true, value: normalized as 'cover' | 'contain' | 'auto' };
}

function normalizeMediaTextImagePositionX(
  value: unknown,
  path: string,
): ParseResult<'left' | 'center' | 'right'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!MEDIA_TEXT_IMAGE_POSITION_X.has(normalized)) {
    return { ok: false, error: `${path} must be one of left, center or right` };
  }
  return { ok: true, value: normalized as 'left' | 'center' | 'right' };
}

function normalizeMediaTextImagePositionY(
  value: unknown,
  path: string,
): ParseResult<'top' | 'center' | 'bottom'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!MEDIA_TEXT_IMAGE_POSITION_Y.has(normalized)) {
    return { ok: false, error: `${path} must be one of top, center or bottom` };
  }
  return { ok: true, value: normalized as 'top' | 'center' | 'bottom' };
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

function normalizeImageCarouselTextPositionX(
  value: unknown,
  path: string,
): ParseResult<'left' | 'center' | 'right'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!IMAGE_CAROUSEL_TEXT_POSITIONS_X.has(normalized)) {
    return { ok: false, error: `${path} must be one of left, center or right` };
  }
  return { ok: true, value: normalized as 'left' | 'center' | 'right' };
}

function normalizeImageCarouselTextPositionY(
  value: unknown,
  path: string,
): ParseResult<'top' | 'center' | 'bottom'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!IMAGE_CAROUSEL_TEXT_POSITIONS_Y.has(normalized)) {
    return { ok: false, error: `${path} must be one of top, center or bottom` };
  }
  return { ok: true, value: normalized as 'top' | 'center' | 'bottom' };
}

function normalizeImageCarouselTextAlign(
  value: unknown,
  path: string,
): ParseResult<'left' | 'center' | 'right'> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!IMAGE_CAROUSEL_TEXT_ALIGNS.has(normalized)) {
    return { ok: false, error: `${path} must be one of left, center or right` };
  }
  return { ok: true, value: normalized as 'left' | 'center' | 'right' };
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

function normalizeSectionLayoutMargin(
  value: unknown,
  path: string,
): ParseResult<number> {
  const normalized = normalizeNumber(value, path);
  if (!normalized.ok) return normalized;
  if (
    !Number.isInteger(normalized.value)
    || normalized.value < SECTION_LAYOUT_MARGIN_MIN
    || normalized.value > SECTION_LAYOUT_MARGIN_MAX
  ) {
    return {
      ok: false,
      error: `${path} must be an integer between ${SECTION_LAYOUT_MARGIN_MIN} and ${SECTION_LAYOUT_MARGIN_MAX}`,
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

function normalizeSignedPixelLengthToken(
  value: unknown,
  path: string,
  min: number,
  max: number,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d{1,4})px$/i);
  if (!match) {
    return { ok: false, error: `${path} must be in Npx format` };
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `${path} must be between ${min}px and ${max}px` };
  }
  return { ok: true, value: `${parsed}px` };
}

function normalizeTextSizeToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const trimmed = value.trim();
  const match = trimmed.match(TEXT_SIZE_TOKEN_PATTERN);
  if (!match) {
    return { ok: false, error: `${path} must use px, em, or rem format` };
  }
  const numeric = Number.parseFloat(match[1]);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { ok: false, error: `${path} must be a valid non-negative size` };
  }
  const unit = match[2].toLowerCase();
  return { ok: true, value: `${match[1]}${unit}` };
}

function normalizeTextSizeFromLegacyNumber(
  value: unknown,
  path: string,
): ParseResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  if (typeof value === 'string') {
    const normalized = normalizeTextSizeToken(value, path);
    if (!normalized.ok) return normalized;
    return { ok: true, value: normalized.value };
  }

  const normalized = normalizeNumber(value, path);
  if (!normalized.ok) return normalized;
  if (normalized.value < 0) {
    return { ok: false, error: `${path} must be greater than or equal to 0` };
  }
  return { ok: true, value: `${normalized.value}px` };
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

function normalizeTextStyleToken(
  value: unknown,
  path: string,
): ParseResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${path} must be a string` };
  }
  const normalized = value.trim().toLowerCase();
  if (!TEXT_STYLE_VALUES.has(normalized)) {
    return { ok: false, error: `${path} must be normal, italic or oblique` };
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

  const allowedKeys = new Set([
    'mode',
    'solidColor',
    'gradient',
    'imageUrl',
    'imageFit',
    'imagePositionX',
    'imagePositionY',
    'imageRepeat',
    'overlay',
  ]);
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
    { allowRelative: true, httpsOnly: false },
    'hero.data.background.imageUrl',
  );
  if (!imageUrl.ok) return imageUrl;
  const imageFit =
    input.imageFit === undefined || input.imageFit === null
      ? ({ ok: true, value: DEFAULT_HERO_IMAGE_FIT } as ParseResult<string>)
      : normalizeString(input.imageFit, 20);
  if (!imageFit.ok) return { ok: false, error: `hero.data.background.imageFit ${imageFit.error}` };
  if (!HERO_IMAGE_FITS.has(imageFit.value)) {
    return {
      ok: false,
      error: 'hero.data.background.imageFit must be one of cover, contain or auto',
    };
  }

  const imagePositionX =
    input.imagePositionX === undefined || input.imagePositionX === null
      ? ({ ok: true, value: DEFAULT_HERO_IMAGE_POSITION_X } as ParseResult<string>)
      : normalizeString(input.imagePositionX, 20);
  if (!imagePositionX.ok) return { ok: false, error: `hero.data.background.imagePositionX ${imagePositionX.error}` };
  if (!HERO_IMAGE_POSITION_X.has(imagePositionX.value)) {
    return {
      ok: false,
      error: 'hero.data.background.imagePositionX must be one of left, center or right',
    };
  }

  const imagePositionY =
    input.imagePositionY === undefined || input.imagePositionY === null
      ? ({ ok: true, value: DEFAULT_HERO_IMAGE_POSITION_Y } as ParseResult<string>)
      : normalizeString(input.imagePositionY, 20);
  if (!imagePositionY.ok) return { ok: false, error: `hero.data.background.imagePositionY ${imagePositionY.error}` };
  if (!HERO_IMAGE_POSITION_Y.has(imagePositionY.value)) {
    return {
      ok: false,
      error: 'hero.data.background.imagePositionY must be one of top, center or bottom',
    };
  }

  const imageRepeat =
    input.imageRepeat === undefined || input.imageRepeat === null
      ? ({ ok: true, value: DEFAULT_HERO_IMAGE_REPEAT } as ParseResult<string>)
      : normalizeString(input.imageRepeat, 20);
  if (!imageRepeat.ok) return { ok: false, error: `hero.data.background.imageRepeat ${imageRepeat.error}` };
  if (!HERO_IMAGE_REPEATS.has(imageRepeat.value)) {
    return {
      ok: false,
      error: 'hero.data.background.imageRepeat must be one of no-repeat, repeat, repeat-x or repeat-y',
    };
  }

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
      imageFit: imageFit.value,
      imagePositionX: imagePositionX.value,
      imagePositionY: imagePositionY.value,
      imageRepeat: imageRepeat.value,
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
    if (key === GLOBAL_RADIUS_BASE_TOKEN || key === HERO_INNER_RADIUS_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        key === GLOBAL_RADIUS_BASE_TOKEN ? GLOBAL_RADIUS_BASE_MIN : HERO_INNER_RADIUS_MIN,
        key === GLOBAL_RADIUS_BASE_TOKEN ? GLOBAL_RADIUS_BASE_MAX : HERO_INNER_RADIUS_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
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
      || key === RICH_TEXT_ACCENT_BAR_COLOR_TOKEN
      || key === RICH_TEXT_SHADOW_COLOR_TOKEN
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
      const value = normalizeTextSizeToken(rawValue, `${path}.${key}`);
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
    if (key === RICH_TEXT_ACCENT_BAR_SIZE_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_ACCENT_BAR_SIZE_MIN,
        RICH_TEXT_ACCENT_BAR_SIZE_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_SHADOW_OFFSET_X_TOKEN || key === RICH_TEXT_SHADOW_OFFSET_Y_TOKEN) {
      const value = normalizeSignedPixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_SHADOW_OFFSET_MIN,
        RICH_TEXT_SHADOW_OFFSET_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_SHADOW_BLUR_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_SHADOW_BLUR_MIN,
        RICH_TEXT_SHADOW_BLUR_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === RICH_TEXT_SHADOW_SPREAD_TOKEN) {
      const value = normalizeSignedPixelLengthToken(
        rawValue,
        `${path}.${key}`,
        RICH_TEXT_SHADOW_SPREAD_MIN,
        RICH_TEXT_SHADOW_SPREAD_MAX,
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
      || key === TESTIMONIALS_CARD_BG_TOKEN
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
      const value = normalizeTextSizeToken(rawValue, `${path}.${key}`);
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
      const value = normalizeTextSizeToken(rawValue, `${path}.${key}`);
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
    if (
      key === NAV_BG_TOKEN
      || key === NAV_MOBILE_PANEL_BG_TOKEN
      || key === NAV_MOBILE_BACKDROP_BG_TOKEN
      || key === NAV_TEXT_COLOR_TOKEN
      || key === NAV_BRAND_COLOR_TOKEN
      || key === NAV_BORDER_COLOR_TOKEN
      || key === NAV_BUTTON_BG_TOKEN
      || key === NAV_BUTTON_TEXT_TOKEN
      || key === NAV_BUTTON_ACTIVE_BG_TOKEN
      || key === NAV_BUTTON_ACTIVE_TEXT_TOKEN
      || key === NAV_DESKTOP_BUTTON_BG_TOKEN
      || key === NAV_DESKTOP_BUTTON_TEXT_TOKEN
      || key === NAV_DESKTOP_BUTTON_ACTIVE_BG_TOKEN
      || key === NAV_DESKTOP_BUTTON_ACTIVE_TEXT_TOKEN
      || key === NAV_MOBILE_BUTTON_BG_TOKEN
      || key === NAV_MOBILE_BUTTON_TEXT_TOKEN
      || key === NAV_MOBILE_BUTTON_ACTIVE_BG_TOKEN
      || key === NAV_MOBILE_BUTTON_ACTIVE_TEXT_TOKEN
      || key === NAV_DESKTOP_BUTTON_BORDER_COLOR_TOKEN
      || key === NAV_MOBILE_BUTTON_BORDER_COLOR_TOKEN
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
    if (key === NAV_TEXT_SIZE_TOKEN || key === NAV_BRAND_SIZE_TOKEN) {
      const value = normalizeTextSizeToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === NAV_BORDER_WIDTH_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        NAV_BORDER_WIDTH_MIN,
        NAV_BORDER_WIDTH_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === NAV_DESKTOP_BUTTON_BORDER_WIDTH_TOKEN
      || key === NAV_MOBILE_BUTTON_BORDER_WIDTH_TOKEN
    ) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        NAV_BORDER_WIDTH_MIN,
        NAV_BORDER_WIDTH_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === NAV_BORDER_RADIUS_TOKEN) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        NAV_BORDER_RADIUS_MIN,
        NAV_BORDER_RADIUS_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (
      key === NAV_DESKTOP_BUTTON_BORDER_RADIUS_TOKEN
      || key === NAV_MOBILE_BUTTON_BORDER_RADIUS_TOKEN
    ) {
      const value = normalizePixelLengthToken(
        rawValue,
        `${path}.${key}`,
        NAV_BORDER_RADIUS_MIN,
        NAV_BORDER_RADIUS_MAX,
      );
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === NAV_TEXT_WEIGHT_TOKEN || key === NAV_BRAND_WEIGHT_TOKEN) {
      const value = normalizeRichTextWeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === NAV_TEXT_STYLE_TOKEN || key === NAV_BRAND_STYLE_TOKEN) {
      const value = normalizeTextStyleToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (key === NAV_TEXT_DECORATION_TOKEN || key === NAV_BRAND_DECORATION_TOKEN) {
      const value = normalizeRichTextDecorationToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (HERO_TEXT_COLOR_TOKENS.has(key)) {
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
    if (HERO_TEXT_SIZE_TOKENS.has(key)) {
      const value = normalizeTextSizeToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (HERO_TEXT_WEIGHT_TOKENS.has(key)) {
      const value = normalizeRichTextWeightToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (HERO_TEXT_STYLE_TOKENS.has(key)) {
      const value = normalizeTextStyleToken(rawValue, `${path}.${key}`);
      if (!value.ok) return value;
      normalized[key] = value.value;
      continue;
    }
    if (HERO_TEXT_DECORATION_TOKENS.has(key)) {
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

function normalizeNavigationStyleTokens(
  input: unknown,
  path: string,
): ParseResult<Record<string, string> | undefined> {
  const normalized = normalizeStyleTokens(input, path);
  if (!normalized.ok || !normalized.value) {
    return normalized;
  }

  for (const key of Object.keys(normalized.value)) {
    if (!NAVIGATION_STYLE_TOKEN_KEYS.has(key)) {
      return {
        ok: false,
        error: `${path}.${key} is not an allowed navigation token`,
      };
    }
  }

  return normalized;
}

function normalizeGlobalThemeStyleTokens(
  input: unknown,
  path: string,
): ParseResult<Record<string, string> | undefined> {
  const normalized = normalizeStyleTokens(input, path);
  if (!normalized.ok || !normalized.value) {
    return normalized;
  }

  for (const key of Object.keys(normalized.value)) {
    if (!GLOBAL_THEME_STYLE_TOKEN_KEYS.has(key)) {
      return {
        ok: false,
        error: `${path}.${key} is not an allowed global style token`,
      };
    }
  }

  return normalized;
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

  const allowedKeys = new Set([
    'variant',
    'position',
    'marginTopPx',
    'marginRightPx',
    'marginBottomPx',
    'marginLeftPx',
    'mobileMenu',
    'styleTokens',
  ]);
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

  if (input.marginTopPx !== undefined && input.marginTopPx !== null) {
    const marginTop = normalizeSectionLayoutMargin(
      input.marginTopPx,
      `${path}.marginTopPx`,
    );
    if (!marginTop.ok) return marginTop;
    normalized.marginTopPx = marginTop.value;
  }

  if (input.marginRightPx !== undefined && input.marginRightPx !== null) {
    const marginRight = normalizeSectionLayoutMargin(
      input.marginRightPx,
      `${path}.marginRightPx`,
    );
    if (!marginRight.ok) return marginRight;
    normalized.marginRightPx = marginRight.value;
  }

  if (input.marginBottomPx !== undefined && input.marginBottomPx !== null) {
    const marginBottom = normalizeSectionLayoutMargin(
      input.marginBottomPx,
      `${path}.marginBottomPx`,
    );
    if (!marginBottom.ok) return marginBottom;
    normalized.marginBottomPx = marginBottom.value;
  }

  if (input.marginLeftPx !== undefined && input.marginLeftPx !== null) {
    const marginLeft = normalizeSectionLayoutMargin(
      input.marginLeftPx,
      `${path}.marginLeftPx`,
    );
    if (!marginLeft.ok) return marginLeft;
    normalized.marginLeftPx = marginLeft.value;
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

  if (input.styleTokens !== undefined && input.styleTokens !== null) {
    const styleTokens = normalizeNavigationStyleTokens(
      input.styleTokens,
      `${path}.styleTokens`,
    );
    if (!styleTokens.ok) return styleTokens;
    if (styleTokens.value && Object.keys(styleTokens.value).length > 0) {
      normalized.styleTokens = styleTokens.value;
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

function isSupportedGoogleMapHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  if (MAP_GOOGLE_HOSTS.has(normalizedHost)) {
    return true;
  }
  return normalizedHost.startsWith('maps.google.');
}

function normalizeGoogleMapEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!isSupportedGoogleMapHost(parsed.hostname)) {
      return null;
    }

    if (parsed.pathname.includes('/maps/embed')) {
      return parsed.toString();
    }

    if (parsed.searchParams.get('output') === 'embed') {
      return parsed.toString();
    }

    const queryValue = parsed.searchParams.get('q')
      || parsed.searchParams.get('query')
      || parsed.searchParams.get('destination');
    if (queryValue) {
      return `https://www.google.com/maps?q=${encodeURIComponent(queryValue)}&output=embed`;
    }

    const placeMatch = parsed.pathname.match(/\/(?:maps\/)?place\/([^/]+)/i);
    if (placeMatch?.[1]) {
      const placeValue = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
      if (placeValue) {
        return `https://www.google.com/maps?q=${encodeURIComponent(placeValue)}&output=embed`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeOpenStreetMapEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!MAP_OSM_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    if (!parsed.pathname.startsWith('/export/embed.html')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
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

  const embedUrl = normalizeGoogleMapEmbedUrl(url)
    || normalizeOpenStreetMapEmbedUrl(url)
    || null;

  if (!embedUrl) {
    return { ok: false, error: MAP_PROVIDER_EMBED_ERROR };
  }

  return { ok: true, value: embedUrl };
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
          { allowRelative: true, httpsOnly: false },
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
        imageFit: DEFAULT_HERO_IMAGE_FIT,
        imagePositionX: DEFAULT_HERO_IMAGE_POSITION_X,
        imagePositionY: DEFAULT_HERO_IMAGE_POSITION_Y,
        imageRepeat: DEFAULT_HERO_IMAGE_REPEAT,
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
          { allowRelative: true, httpsOnly: false },
          'mediaText.data.mediaUrl',
        );
  if (!mediaUrl.ok) return { ok: false, error: mediaUrl.error };

  const mediaAlt = normalizeOptionalString(input.mediaAlt, MAX_SHORT_TEXT_LENGTH);
  if (!mediaAlt.ok) return { ok: false, error: `mediaText.data.mediaAlt ${mediaAlt.error}` };

  const legacyDesktopImageHeightPx =
    input.imageHeightPx === undefined || input.imageHeightPx === null
      ? ({ ok: true, value: undefined } as ParseResult<number | undefined>)
      : normalizeNumber(input.imageHeightPx, 'mediaText.data.imageHeightPx');
  if (!legacyDesktopImageHeightPx.ok) return legacyDesktopImageHeightPx;
  if (
    legacyDesktopImageHeightPx.value !== undefined
    && (!Number.isInteger(legacyDesktopImageHeightPx.value)
      || legacyDesktopImageHeightPx.value < MEDIA_TEXT_IMAGE_HEIGHT_MIN
      || legacyDesktopImageHeightPx.value > MEDIA_TEXT_IMAGE_HEIGHT_MAX)
  ) {
    return {
      ok: false,
      error: `mediaText.data.imageHeightPx must be an integer between ${MEDIA_TEXT_IMAGE_HEIGHT_MIN} and ${MEDIA_TEXT_IMAGE_HEIGHT_MAX}`,
    };
  }

  const imageHeightMobilePx =
    input.imageHeightMobilePx === undefined || input.imageHeightMobilePx === null
      ? ({ ok: true, value: undefined } as ParseResult<number | undefined>)
      : normalizeNumber(input.imageHeightMobilePx, 'mediaText.data.imageHeightMobilePx');
  if (!imageHeightMobilePx.ok) return imageHeightMobilePx;
  if (
    imageHeightMobilePx.value !== undefined
    && (!Number.isInteger(imageHeightMobilePx.value)
      || imageHeightMobilePx.value < MEDIA_TEXT_IMAGE_HEIGHT_MIN
      || imageHeightMobilePx.value > MEDIA_TEXT_IMAGE_HEIGHT_MAX)
  ) {
    return {
      ok: false,
      error: `mediaText.data.imageHeightMobilePx must be an integer between ${MEDIA_TEXT_IMAGE_HEIGHT_MIN} and ${MEDIA_TEXT_IMAGE_HEIGHT_MAX}`,
    };
  }

  const imageHeightDesktopPx =
    input.imageHeightDesktopPx === undefined || input.imageHeightDesktopPx === null
      ? ({ ok: true, value: legacyDesktopImageHeightPx.value } as ParseResult<number | undefined>)
      : normalizeNumber(input.imageHeightDesktopPx, 'mediaText.data.imageHeightDesktopPx');
  if (!imageHeightDesktopPx.ok) return imageHeightDesktopPx;
  if (
    imageHeightDesktopPx.value !== undefined
    && (!Number.isInteger(imageHeightDesktopPx.value)
      || imageHeightDesktopPx.value < MEDIA_TEXT_IMAGE_HEIGHT_MIN
      || imageHeightDesktopPx.value > MEDIA_TEXT_IMAGE_HEIGHT_MAX)
  ) {
    return {
      ok: false,
      error: `mediaText.data.imageHeightDesktopPx must be an integer between ${MEDIA_TEXT_IMAGE_HEIGHT_MIN} and ${MEDIA_TEXT_IMAGE_HEIGHT_MAX}`,
    };
  }

  const imageWidthDesktopPercent =
    input.imageWidthDesktopPercent === undefined || input.imageWidthDesktopPercent === null
      ? ({ ok: true, value: undefined } as ParseResult<number | undefined>)
      : normalizeNumber(input.imageWidthDesktopPercent, 'mediaText.data.imageWidthDesktopPercent');
  if (!imageWidthDesktopPercent.ok) return imageWidthDesktopPercent;
  if (
    imageWidthDesktopPercent.value !== undefined
    && (!Number.isInteger(imageWidthDesktopPercent.value)
      || imageWidthDesktopPercent.value < MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MIN
      || imageWidthDesktopPercent.value > MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MAX)
  ) {
    return {
      ok: false,
      error: `mediaText.data.imageWidthDesktopPercent must be an integer between ${MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MIN} and ${MEDIA_TEXT_IMAGE_WIDTH_DESKTOP_PERCENT_MAX}`,
    };
  }

  const desktopFromBreakpoint =
    input.desktopFromBreakpoint === undefined || input.desktopFromBreakpoint === null
      ? ({ ok: true, value: MEDIA_TEXT_DEFAULT_DESKTOP_FROM_BREAKPOINT } as ParseResult<string>)
      : normalizeString(input.desktopFromBreakpoint, 20);
  if (!desktopFromBreakpoint.ok) {
    return {
      ok: false,
      error: `mediaText.data.desktopFromBreakpoint ${desktopFromBreakpoint.error}`,
    };
  }
  if (!MEDIA_TEXT_DESKTOP_FROM_BREAKPOINTS.has(desktopFromBreakpoint.value)) {
    return {
      ok: false,
      error: 'mediaText.data.desktopFromBreakpoint must be one of sm, md, lg or xl',
    };
  }

  const textAlign =
    input.textAlign === undefined || input.textAlign === null
      ? ({ ok: true, value: undefined } as ParseResult<'left' | 'center' | undefined>)
      : normalizeMediaTextAlign(input.textAlign, 'mediaText.data.textAlign');
  if (!textAlign.ok) return textAlign;

  const imageFitMobile =
    input.imageFitMobile === undefined || input.imageFitMobile === null
      ? ({ ok: true, value: 'cover' } as ParseResult<'cover' | 'contain' | 'auto'>)
      : normalizeMediaTextImageFit(input.imageFitMobile, 'mediaText.data.imageFitMobile');
  if (!imageFitMobile.ok) return imageFitMobile;

  const imageFitDesktop =
    input.imageFitDesktop === undefined || input.imageFitDesktop === null
      ? ({ ok: true, value: imageFitMobile.value } as ParseResult<'cover' | 'contain' | 'auto'>)
      : normalizeMediaTextImageFit(input.imageFitDesktop, 'mediaText.data.imageFitDesktop');
  if (!imageFitDesktop.ok) return imageFitDesktop;

  const imagePositionXMobile =
    input.imagePositionXMobile === undefined || input.imagePositionXMobile === null
      ? ({ ok: true, value: 'center' } as ParseResult<'left' | 'center' | 'right'>)
      : normalizeMediaTextImagePositionX(input.imagePositionXMobile, 'mediaText.data.imagePositionXMobile');
  if (!imagePositionXMobile.ok) return imagePositionXMobile;

  const imagePositionYMobile =
    input.imagePositionYMobile === undefined || input.imagePositionYMobile === null
      ? ({ ok: true, value: 'center' } as ParseResult<'top' | 'center' | 'bottom'>)
      : normalizeMediaTextImagePositionY(input.imagePositionYMobile, 'mediaText.data.imagePositionYMobile');
  if (!imagePositionYMobile.ok) return imagePositionYMobile;

  const imagePositionXDesktop =
    input.imagePositionXDesktop === undefined || input.imagePositionXDesktop === null
      ? ({ ok: true, value: imagePositionXMobile.value } as ParseResult<'left' | 'center' | 'right'>)
      : normalizeMediaTextImagePositionX(input.imagePositionXDesktop, 'mediaText.data.imagePositionXDesktop');
  if (!imagePositionXDesktop.ok) return imagePositionXDesktop;

  const imagePositionYDesktop =
    input.imagePositionYDesktop === undefined || input.imagePositionYDesktop === null
      ? ({ ok: true, value: imagePositionYMobile.value } as ParseResult<'top' | 'center' | 'bottom'>)
      : normalizeMediaTextImagePositionY(input.imagePositionYDesktop, 'mediaText.data.imagePositionYDesktop');
  if (!imagePositionYDesktop.ok) return imagePositionYDesktop;

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      mediaPosition: mediaPositionValue,
      imageFitMobile: imageFitMobile.value,
      imageFitDesktop: imageFitDesktop.value,
      imagePositionXMobile: imagePositionXMobile.value,
      imagePositionYMobile: imagePositionYMobile.value,
      imagePositionXDesktop: imagePositionXDesktop.value,
      imagePositionYDesktop: imagePositionYDesktop.value,
      ...(mediaUrl.value ? { mediaUrl: mediaUrl.value } : {}),
      ...(mediaAlt.value ? { mediaAlt: mediaAlt.value } : {}),
      ...(legacyDesktopImageHeightPx.value !== undefined ? { imageHeightPx: legacyDesktopImageHeightPx.value } : {}),
      ...(imageHeightMobilePx.value !== undefined ? { imageHeightMobilePx: imageHeightMobilePx.value } : {}),
      ...(imageHeightDesktopPx.value !== undefined ? { imageHeightDesktopPx: imageHeightDesktopPx.value } : {}),
      ...(imageWidthDesktopPercent.value !== undefined ? { imageWidthDesktopPercent: imageWidthDesktopPercent.value } : {}),
      ...(desktopFromBreakpoint.value ? { desktopFromBreakpoint: desktopFromBreakpoint.value } : {}),
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

  const showArrows =
    input.showArrows === undefined || input.showArrows === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.showArrows, 'testimonials.data.showArrows');
  if (!showArrows.ok) return showArrows;

  const showIndicators =
    input.showIndicators === undefined || input.showIndicators === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.showIndicators, 'testimonials.data.showIndicators');
  if (!showIndicators.ok) return showIndicators;

  const autoplay =
    input.autoplay === undefined || input.autoplay === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.autoplay, 'testimonials.data.autoplay');
  if (!autoplay.ok) return autoplay;

  return {
    ok: true,
    value: {
      variant,
      itemsPerViewDesktop,
      ...(showArrows.value !== undefined ? { showArrows: showArrows.value } : {}),
      ...(showIndicators.value !== undefined ? { showIndicators: showIndicators.value } : {}),
      ...(autoplay.value !== undefined ? { autoplay: autoplay.value } : {}),
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
    { allowRelative: true, httpsOnly: false },
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

  const titleSize = normalizeTextSizeFromLegacyNumber(
    input.titleSize !== undefined && input.titleSize !== null ? input.titleSize : input.titleSizePx,
    `imageCarousel.data.slides[${index}].titleSize`,
  );
  if (!titleSize.ok) return titleSize;
  if (titleSize.value) {
    normalized.titleSize = titleSize.value;
  }

  const descriptionSize = normalizeTextSizeFromLegacyNumber(
    input.descriptionSize !== undefined && input.descriptionSize !== null ? input.descriptionSize : input.descriptionSizePx,
    `imageCarousel.data.slides[${index}].descriptionSize`,
  );
  if (!descriptionSize.ok) return descriptionSize;
  if (descriptionSize.value) {
    normalized.descriptionSize = descriptionSize.value;
  }

  const cta = normalizeImageCarouselCta(
    input.cta,
    `imageCarousel.data.slides[${index}].cta`,
  );
  if (!cta.ok) return cta;
  if (cta.value) {
    normalized.cta = cta.value;
  }

  if (variant.value === 'overlay') {
    const textPositionX =
      input.textPositionX === undefined || input.textPositionX === null
        ? ({ ok: true, value: 'center' } as ParseResult<'left' | 'center' | 'right'>)
        : normalizeImageCarouselTextPositionX(
            input.textPositionX,
            `imageCarousel.data.slides[${index}].textPositionX`,
          );
    if (!textPositionX.ok) return textPositionX;

    const textPositionY =
      input.textPositionY === undefined || input.textPositionY === null
        ? ({ ok: true, value: 'center' } as ParseResult<'top' | 'center' | 'bottom'>)
        : normalizeImageCarouselTextPositionY(
            input.textPositionY,
            `imageCarousel.data.slides[${index}].textPositionY`,
          );
    if (!textPositionY.ok) return textPositionY;

    const textAlign =
      input.textAlign === undefined || input.textAlign === null
        ? ({ ok: true, value: 'center' } as ParseResult<'left' | 'center' | 'right'>)
        : normalizeImageCarouselTextAlign(
            input.textAlign,
            `imageCarousel.data.slides[${index}].textAlign`,
          );
    if (!textAlign.ok) return textAlign;

    normalized.textPositionX = textPositionX.value;
    normalized.textPositionY = textPositionY.value;
    normalized.textAlign = textAlign.value;

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

  const textPositionY =
    input.textPositionY === undefined || input.textPositionY === null
      ? ({ ok: true, value: 'center' } as ParseResult<'top' | 'center' | 'bottom'>)
      : normalizeImageCarouselTextPositionY(
          input.textPositionY,
          `imageCarousel.data.slides[${index}].textPositionY`,
        );
  if (!textPositionY.ok) return textPositionY;

  const textAlign =
    input.textAlign === undefined || input.textAlign === null
      ? ({ ok: true, value: 'left' } as ParseResult<'left' | 'center' | 'right'>)
      : normalizeImageCarouselTextAlign(
          input.textAlign,
          `imageCarousel.data.slides[${index}].textAlign`,
        );
  if (!textAlign.ok) return textAlign;

  normalized.textPositionY = textPositionY.value;
  normalized.textAlign = textAlign.value;

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
      { allowRelative: true, httpsOnly: false },
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

  const showArrows =
    input.showArrows === undefined || input.showArrows === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.showArrows, 'imageCarousel.data.showArrows');
  if (!showArrows.ok) return showArrows;

  const showIndicators =
    input.showIndicators === undefined || input.showIndicators === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.showIndicators, 'imageCarousel.data.showIndicators');
  if (!showIndicators.ok) return showIndicators;

  const autoplay =
    input.autoplay === undefined || input.autoplay === null
      ? ({ ok: true, value: undefined } as ParseResult<boolean | undefined>)
      : normalizeBoolean(input.autoplay, 'imageCarousel.data.autoplay');
  if (!autoplay.ok) return autoplay;

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
      ...(showArrows.value !== undefined ? { showArrows: showArrows.value } : {}),
      ...(showIndicators.value !== undefined ? { showIndicators: showIndicators.value } : {}),
      ...(autoplay.value !== undefined ? { autoplay: autoplay.value } : {}),
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

function normalizeThemeFooter(
  input: unknown,
  path: string,
): ParseResult<AnyRecord | undefined> {
  if (input === undefined || input === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const allowedKeys = new Set(['data', 'styleTokens', 'layout']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `${path}.${key} is not supported` };
    }
  }

  const data = normalizeFooterData(input.data);
  if (!data.ok) {
    return { ok: false, error: data.error };
  }

  const styleTokens = normalizeStyleTokens(input.styleTokens, `${path}.styleTokens`);
  if (!styleTokens.ok) return styleTokens;
  const layout = normalizeSectionLayout(input.layout, `${path}.layout`);
  if (!layout.ok) return layout;

  return {
    ok: true,
    value: {
      data: data.value,
      ...(styleTokens.value ? { styleTokens: styleTokens.value } : {}),
      ...(layout.value ? { layout: layout.value } : {}),
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

  const allowedKeys = new Set([
    'wrapper',
    'minHeightPx',
    'heightPx',
    'marginTopPx',
    'marginBottomPx',
    'borderWidthPx',
    'borderRadiusPx',
    'borderColor',
  ]);
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

  let marginTopPx: number | undefined;
  if (input.marginTopPx !== undefined && input.marginTopPx !== null) {
    const normalizedMarginTop = normalizeSectionLayoutMargin(
      input.marginTopPx,
      `${path}.marginTopPx`,
    );
    if (!normalizedMarginTop.ok) return normalizedMarginTop;
    marginTopPx = normalizedMarginTop.value;
  }

  let marginBottomPx: number | undefined;
  if (input.marginBottomPx !== undefined && input.marginBottomPx !== null) {
    const normalizedMarginBottom = normalizeSectionLayoutMargin(
      input.marginBottomPx,
      `${path}.marginBottomPx`,
    );
    if (!normalizedMarginBottom.ok) return normalizedMarginBottom;
    marginBottomPx = normalizedMarginBottom.value;
  }

  let borderWidthPx: number | undefined;
  if (input.borderWidthPx !== undefined && input.borderWidthPx !== null) {
    const normalizedBorderWidth = normalizeNumber(
      input.borderWidthPx,
      `${path}.borderWidthPx`,
    );
    if (!normalizedBorderWidth.ok) return normalizedBorderWidth;
    if (
      !Number.isInteger(normalizedBorderWidth.value)
      || normalizedBorderWidth.value < SECTION_LAYOUT_BORDER_WIDTH_MIN
      || normalizedBorderWidth.value > SECTION_LAYOUT_BORDER_WIDTH_MAX
    ) {
      return {
        ok: false,
        error: `${path}.borderWidthPx must be an integer between ${SECTION_LAYOUT_BORDER_WIDTH_MIN} and ${SECTION_LAYOUT_BORDER_WIDTH_MAX}`,
      };
    }
    borderWidthPx = normalizedBorderWidth.value;
  }

  let borderRadiusPx: number | undefined;
  if (input.borderRadiusPx !== undefined && input.borderRadiusPx !== null) {
    const normalizedBorderRadius = normalizeNumber(
      input.borderRadiusPx,
      `${path}.borderRadiusPx`,
    );
    if (!normalizedBorderRadius.ok) return normalizedBorderRadius;
    if (
      !Number.isInteger(normalizedBorderRadius.value)
      || normalizedBorderRadius.value < SECTION_LAYOUT_BORDER_RADIUS_MIN
      || normalizedBorderRadius.value > SECTION_LAYOUT_BORDER_RADIUS_MAX
    ) {
      return {
        ok: false,
        error: `${path}.borderRadiusPx must be an integer between ${SECTION_LAYOUT_BORDER_RADIUS_MIN} and ${SECTION_LAYOUT_BORDER_RADIUS_MAX}`,
      };
    }
    borderRadiusPx = normalizedBorderRadius.value;
  }

  let borderColor: string | undefined;
  if (input.borderColor !== undefined && input.borderColor !== null) {
    if (typeof input.borderColor !== 'string') {
      return { ok: false, error: `${path}.borderColor must be a string` };
    }
    const normalizedBorderColor = input.borderColor.trim();
    if (!normalizedBorderColor) {
      return { ok: false, error: `${path}.borderColor must not be empty` };
    }
    if (!isSafeColorValue(normalizedBorderColor)) {
      return { ok: false, error: `${path}.borderColor is invalid` };
    }
    borderColor = normalizedBorderColor;
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
    ...(marginTopPx !== undefined ? { marginTopPx } : {}),
    ...(marginBottomPx !== undefined ? { marginBottomPx } : {}),
    ...(borderWidthPx !== undefined ? { borderWidthPx } : {}),
    ...(borderRadiusPx !== undefined ? { borderRadiusPx } : {}),
    ...(borderColor ? { borderColor } : {}),
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
    const footer = normalizeThemeFooter(
      root.value.theme.footer,
      'siteConfig.theme.footer',
    );
    if (!footer.ok) {
      return footer;
    }

    const themeData: AnyRecord = {};
    const globalStyleTokens = normalizeGlobalThemeStyleTokens(
      root.value.theme.globalStyleTokens,
      'siteConfig.theme.globalStyleTokens',
    );
    if (!globalStyleTokens.ok) {
      return globalStyleTokens;
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
      themeData.components = components;
    }

    if (navigation.value) {
      themeData.navigation = navigation.value;
    }

    if (footer.value) {
      themeData.footer = footer.value;
    }

    if (globalStyleTokens.value && Object.keys(globalStyleTokens.value).length > 0) {
      themeData.globalStyleTokens = globalStyleTokens.value;
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
