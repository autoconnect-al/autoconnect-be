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
    describe('should detect customs paid indicators', () => {
      it('should detect "pa dogane"', () => {
        expect(isCustomsPaid('pa dogane')).toBe(true);
        expect(isCustomsPaid('Makina pa dogane')).toBe(true);
      });

      it('should detect "pa letra"', () => {
        expect(isCustomsPaid('pa letra')).toBe(true);
        expect(isCustomsPaid('Gjendja perfekte pa letra')).toBe(true);
      });

      it('should detect "deri ne durres"', () => {
        expect(isCustomsPaid('deri ne durres')).toBe(true);
        expect(isCustomsPaid('Dorezone deri ne durres')).toBe(true);
      });

      it('should detect "deri ne port"', () => {
        expect(isCustomsPaid('deri ne port')).toBe(true);
        expect(isCustomsPaid('Makina deri ne port')).toBe(true);
      });

      it('should detect "paguar dogane"', () => {
        expect(isCustomsPaid('paguar dogane')).toBe(true);
      });

      it('should detect "dogane te paguar"', () => {
        expect(isCustomsPaid('dogane te paguar')).toBe(true);
      });

      it('should detect "nuk ka dogane"', () => {
        expect(isCustomsPaid('nuk ka dogane')).toBe(true);
      });

      it('should detect "bie dogane"', () => {
        expect(isCustomsPaid('bie dogane')).toBe(true);
      });

      it('should detect "dogana kaluar"', () => {
        expect(isCustomsPaid('dogana kaluar')).toBe(true);
      });

      it('should detect "dogane lire"', () => {
        expect(isCustomsPaid('dogane lire')).toBe(true);
      });

      it('should detect "pa pezullim"', () => {
        expect(isCustomsPaid('pa pezullim')).toBe(true);
      });

      it('should detect "importue"', () => {
        expect(isCustomsPaid('importue')).toBe(true);
      });

      it('should detect "blerje direkte"', () => {
        expect(isCustomsPaid('blerje direkte')).toBe(true);
      });

      it('should detect "deri shtepi"', () => {
        expect(isCustomsPaid('deri shtepi')).toBe(true);
      });

      it('should detect "dogane paguara"', () => {
        expect(isCustomsPaid('dogane paguara')).toBe(true);
      });
    });

    it('should be case insensitive', () => {
      expect(isCustomsPaid('PA DOGANE')).toBe(true);
      expect(isCustomsPaid('Pa Dogane')).toBe(true);
      expect(isCustomsPaid('DERI NE DURRES')).toBe(true);
    });

    it('should return false when no keywords found', () => {
      expect(isCustomsPaid('Makina e bukur per shitje')).toBe(false);
      expect(isCustomsPaid('Kontakt 06XXXXXXX')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isCustomsPaid(null)).toBe(false);
      expect(isCustomsPaid(undefined)).toBe(false);
    });

    it('should handle real caption examples', () => {
      // Real world example captions
      expect(isCustomsPaid('Makina pa dogane, i mire per te marrur')).toBe(
        true,
      );
      expect(
        isCustomsPaid(
          'Deri ne durres, dogana kaluar, gjendje perfekte, kontakt',
        ),
      ).toBe(true);
      expect(isCustomsPaid('Makina per shitje, dogane lire')).toBe(true);
      expect(isCustomsPaid('Makina e vjetersuar, duhet dogane')).toBe(false);
      expect(isCustomsPaid('Makina importue nga Europa')).toBe(true);
    });
  });
});
