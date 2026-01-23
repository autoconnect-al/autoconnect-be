/**
 * Utility functions for processing captions
 */

/**
 * Removes emojis and text formatting from caption
 * @param caption - Original caption text
 * @returns Cleaned caption without emojis
 */
export function generateCleanedCaption(
  caption: string | null | undefined,
): string {
  if (!caption) return '';

  // Remove emojis using regex patterns
  // This regex matches most common emoji ranges
  let cleaned = caption.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
    '',
  );

  // Remove other formatting characters and normalize whitespace
  cleaned = cleaned
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\n\r\t]+/g, ' ') // Normalize line breaks and tabs to spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  return cleaned;
}

/**
 * Encodes caption to Base64
 * @param caption - Caption text to encode
 * @returns Base64 encoded caption
 */
export function encodeCaption(caption: string | null | undefined): string {
  if (!caption) return '';
  return Buffer.from(caption, 'utf-8').toString('base64');
}

/**
 * Decodes Base64 caption
 * @param encodedCaption - Base64 encoded caption
 * @returns Decoded caption text
 */
export function decodeCaption(
  encodedCaption: string | null | undefined,
): string {
  if (!encodedCaption) return '';
  try {
    return Buffer.from(encodedCaption, 'base64').toString('utf-8');
  } catch {
    return encodedCaption; // Return as-is if not valid base64
  }
}

/**
 * Checks if a post is sold based on keywords in cleanedCaption
 * Keywords: sold, shitur, u shit, porositur, rezervuar
 * Exclude if contains: per te shitur
 * @param cleanedCaption - Cleaned caption text
 * @returns true if post is sold, false otherwise
 */
export function isSold(cleanedCaption: string | null | undefined): boolean {
  if (!cleanedCaption) return false;

  const lowerCaption = cleanedCaption.toLowerCase();

  // Exclude if contains "per te shitur"
  if (lowerCaption.includes('per te shitur')) {
    return false;
  }

  // Check for sold keywords
  const soldKeywords = ['sold', 'shitur', 'u shit', 'porositur', 'rezervuar'];
  return soldKeywords.some((keyword) => lowerCaption.includes(keyword));
}
