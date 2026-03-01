import {
  generateCleanedCaption,
  isSold,
  isCustomsPaid,
} from './caption-processor';

describe('caption-processor', () => {
  describe('generateCleanedCaption', () => {
    it('should remove emojis from caption', () => {
      const caption = 'Nice car 🚗 for sale 💰';
      const result = generateCleanedCaption(caption);
      expect(result).toBe('Nice car for sale');
    });

    it('should handle null/undefined', () => {
      expect(generateCleanedCaption(null)).toBe('');
      expect(generateCleanedCaption(undefined)).toBe('');
    });

    it('should normalize whitespace', () => {
      const caption = 'Nice   car  \n  for   sale';
      const result = generateCleanedCaption(caption);
      expect(result).toBe('Nice car for sale');
    });
  });

  describe('isSold', () => {
    it('should detect sold posts', () => {
      expect(isSold('Makina e shitur')).toBe(true);
      expect(isSold('SOLD')).toBe(true);
      expect(isSold('u shit')).toBe(true);
      expect(isSold('porositur')).toBe(true);
      expect(isSold('rezervuar')).toBe(true);
      expect(isSold('blere me sukses')).toBe(true);
      expect(isSold('blerë me sukses')).toBe(true);
      expect(isSold('blere me suskses')).toBe(true);
    });

    it('should not detect sold if contains "per te shitur"', () => {
      expect(isSold('per te shitur')).toBe(false);
      expect(isSold('makina per te shitur')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isSold(null)).toBe(false);
      expect(isSold(undefined)).toBe(false);
    });
  });

  describe('isCustomsPaid', () => {
    const paidKeywords = [
      'me dogane',
      'dogana paguar',
      'gati per targa',
      'dogan paguar',
      'dogane te paguar',
    ];

    const unpaidKeywords = [
      'pa dogane',
      'pa dogan',
      'pa doganë',
      'deri ne durres',
      'deri ne durrës',
      'deri ne port',
      'deri ne portë',
      'shipping price',
    ];

    it('returns true for known paid indicators', () => {
      for (const term of paidKeywords) {
        expect(isCustomsPaid(term)).toBe(true);
      }
    });

    it('returns false for known unpaid indicators', () => {
      for (const term of unpaidKeywords) {
        expect(isCustomsPaid(term)).toBe(false);
      }
    });

    it('is case insensitive', () => {
      expect(isCustomsPaid('ME DOGANE')).toBe(true);
      expect(isCustomsPaid('Pa Dogane')).toBe(false);
      expect(isCustomsPaid('DERI NE DURRES')).toBe(false);
      expect(isCustomsPaid('Shipping Price')).toBe(false);
    });

    it('returns null when no keywords match', () => {
      expect(isCustomsPaid('Makina e bukur per shitje')).toBeNull();
      expect(isCustomsPaid('Kontakt 06XXXXXXX')).toBeNull();
    });

    it('handles null/undefined safely', () => {
      expect(isCustomsPaid(null)).toBeNull();
      expect(isCustomsPaid(undefined)).toBeNull();
    });

    it('handles real caption examples that match present keywords', () => {
      expect(isCustomsPaid('Makina me dogane, e paguar')).toBe(true);
      expect(isCustomsPaid('Deri ne port, pa dogane')).toBe(false);
      expect(isCustomsPaid('Dogana paguar ne dritare')).toBe(true);
    });
  });
});
