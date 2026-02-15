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

  // Remove emojis using a comprehensive regex pattern
  // This pattern matches most emoji ranges including:
  // - Emoticons, symbols, and pictographs
  // - Transport and map symbols
  // - Additional symbols and pictographs
  let cleaned = caption.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE00}-\u{FE0F}]/gu,
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

  // Check if the string looks like valid base64
  // Must be at least 4 characters and match base64 pattern with proper padding
  if (encodedCaption.length < 4) {
    return encodedCaption;
  }

  // More strict base64 validation: check for proper padding and length
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  const isValidLength = encodedCaption.length % 4 === 0;

  if (!base64Regex.test(encodedCaption) || !isValidLength) {
    return encodedCaption; // Return as-is if doesn't look like base64
  }

  try {
    const decoded = Buffer.from(encodedCaption, 'base64').toString('utf-8');
    // If decoded string contains invalid UTF-8 sequences or control characters,
    // it's probably not valid base64
    if (decoded.includes('\uFFFD')) {
      return encodedCaption;
    }
    return decoded;
  } catch {
    return encodedCaption; // Return as-is if decoding fails
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
  const soldKeywords = [
    'sold',
    'shitur',
    'u shit',
    'porositur',
    'rezervuar',
    's h i t u r',
  ];
  return soldKeywords.some((keyword) => lowerCaption.includes(keyword));
}

/**
 * Checks if customs have been paid based on keywords in cleanedCaption
 * First checks for terms indicating customs are paid.
 * Then checks for terms indicating customs are NOT paid.
 * If customs paid terms are found, returns true.
 * If customs not paid terms are found, returns false.
 * If neither are found, returns null (unknown status).
 * @param cleanedCaption - Cleaned caption text
 * @returns true if customs are paid, false if not paid, null if unknown
 */
export function isCustomsPaid(
  cleanedCaption: string | null | undefined,
): boolean | null {
  if (!cleanedCaption) return null;

  const lowerCaption = cleanedCaption.toLowerCase();

  // Terms indicating customs have been paid
  const termsForCustomsPaid = [
    'dogane lire',
    'pa pezullim',
    'nuk ka dogane',
    'bie dogane',
    'dogana kaluar',
    'paguar dogane',
    'me dogane',
    'me dogan',
    'me doganë',
    'doganë të paguar',
    'dogane te paguar',
    'dogane paguara',
    'dogana e paguar',
    'dogana paguar',
    'letrat e paguara',
    'letrat te paguara',
    'letrat të paguara',
    'importue',
    'blerje direkte',
    'gati per targa',
    'dogan paguar',
    'e sapo targuar',
    'sapo targuar',
    'targuar',
  ];

  // Terms indicating customs have NOT been paid
  const termsForCustomsNotPaid = [
    'duhet dogane',
    'pa dogan te paguar',
    'pa dogane te paguar',
    'pa dogane',
    'pa dogan',
    'pa doganë',
    'pa letra',
    'deri ne durres',
    'deri në durrës',
    'deri ne port',
  ];

  // Check for customs paid terms first
  for (const term of termsForCustomsPaid) {
    if (lowerCaption.includes(term)) {
      return true;
    }
  }

  // Check for customs not paid terms
  for (const term of termsForCustomsNotPaid) {
    if (lowerCaption.includes(term)) {
      return false;
    }
  }

  // If no terms found, return unknown status
  return null;
}
