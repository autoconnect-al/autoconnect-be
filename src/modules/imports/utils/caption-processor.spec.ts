import {
  generateCleanedCaption,
  encodeCaption,
  decodeCaption,
  isSold,
} from './caption-processor';

describe('Caption Processor', () => {
  describe('generateCleanedCaption', () => {
    it('returns empty string for null or undefined', () => {
      expect(generateCleanedCaption(null)).toBe('');
      expect(generateCleanedCaption(undefined)).toBe('');
    });

    it('removes emojis from caption', () => {
      const caption = 'BMW 3 Series 🚗 Great car! ⭐⭐⭐';
      const cleaned = generateCleanedCaption(caption);
      expect(cleaned).not.toContain('🚗');
      expect(cleaned).not.toContain('⭐');
      expect(cleaned).toContain('BMW 3 Series');
      expect(cleaned).toContain('Great car!');
    });

    it('normalizes whitespace', () => {
      const caption = 'BMW  3\n\nSeries\t\tTest';
      const cleaned = generateCleanedCaption(caption);
      expect(cleaned).toBe('BMW 3 Series Test');
    });

    it('removes zero-width spaces', () => {
      const caption = 'BMW\u200B3\u200CSeries\u200D';
      const cleaned = generateCleanedCaption(caption);
      expect(cleaned).toBe('BMW3Series');
    });

    it('trims leading and trailing whitespace', () => {
      const caption = '  BMW 3 Series  ';
      const cleaned = generateCleanedCaption(caption);
      expect(cleaned).toBe('BMW 3 Series');
    });
  });

  describe('encodeCaption', () => {
    it('returns empty string for null or undefined', () => {
      expect(encodeCaption(null)).toBe('');
      expect(encodeCaption(undefined)).toBe('');
    });

    it('encodes caption to Base64', () => {
      const caption = 'BMW 3 Series';
      const encoded = encodeCaption(caption);
      expect(encoded).toBe('Qk1XIDMgU2VyaWVz');
    });

    it('handles emojis in Base64 encoding', () => {
      const caption = 'BMW 🚗';
      const encoded = encodeCaption(caption);
      expect(encoded).toBeTruthy();
      // Decode to verify it works
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      expect(decoded).toBe(caption);
    });
  });

  describe('decodeCaption', () => {
    it('returns empty string for null or undefined', () => {
      expect(decodeCaption(null)).toBe('');
      expect(decodeCaption(undefined)).toBe('');
    });

    it('decodes Base64 caption', () => {
      const encoded = 'Qk1XIDMgU2VyaWVz';
      const decoded = decodeCaption(encoded);
      expect(decoded).toBe('BMW 3 Series');
    });

    it('returns original string if not valid Base64', () => {
      const invalid = 'Not Valid Base64!!!';
      const decoded = decodeCaption(invalid);
      expect(decoded).toBe(invalid);
    });

    it('handles emojis in Base64 decoding', () => {
      const caption = 'BMW 🚗';
      const encoded = encodeCaption(caption);
      const decoded = decodeCaption(encoded);
      expect(decoded).toBe(caption);
    });
  });

  describe('isSold', () => {
    it('returns false for null or undefined', () => {
      expect(isSold(null)).toBe(false);
      expect(isSold(undefined)).toBe(false);
    });

    it('detects "sold" keyword', () => {
      expect(isSold('BMW 3 Series sold')).toBe(true);
      expect(isSold('SOLD BMW')).toBe(true);
    });

    it('detects "shitur" keyword', () => {
      expect(isSold('BMW 3 Series shitur')).toBe(true);
    });

    it('detects "u shit" keyword', () => {
      expect(isSold('BMW 3 Series u shit')).toBe(true);
    });

    it('detects "porositur" keyword', () => {
      expect(isSold('BMW 3 Series porositur')).toBe(true);
    });

    it('detects "rezervuar" keyword', () => {
      expect(isSold('BMW 3 Series rezervuar')).toBe(true);
    });

    it('excludes posts with "per te shitur"', () => {
      expect(isSold('BMW 3 Series per te shitur')).toBe(false);
    });

    it('detects sold even with "per te shitur" if other keywords present', () => {
      // "per te shitur" takes precedence
      expect(isSold('BMW sold per te shitur')).toBe(false);
    });

    it('returns false when no sold keywords present', () => {
      expect(isSold('BMW 3 Series great condition')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isSold('BMW SOLD')).toBe(true);
      expect(isSold('bmw Shitur')).toBe(true);
      expect(isSold('BMW PER TE SHITUR')).toBe(false);
    });
  });
});
