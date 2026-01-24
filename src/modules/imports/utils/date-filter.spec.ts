import { isWithinThreeMonths } from './date-filter';

describe('Date Filter', () => {
  describe('isWithinThreeMonths', () => {
    it('returns false for null or undefined', () => {
      expect(isWithinThreeMonths(null)).toBe(false);
      expect(isWithinThreeMonths(undefined)).toBe(false);
    });

    it('returns true for posts from today', () => {
      const now = Date.now() / 1000; // Unix timestamp in seconds
      expect(isWithinThreeMonths(now)).toBe(true);
    });

    it('returns true for posts from 1 month ago', () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const timestamp = oneMonthAgo.getTime() / 1000;
      expect(isWithinThreeMonths(timestamp)).toBe(true);
    });

    it('returns true for posts from 2 months ago', () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const timestamp = twoMonthsAgo.getTime() / 1000;
      expect(isWithinThreeMonths(timestamp)).toBe(true);
    });

    it('returns false for posts from 4 months ago', () => {
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
      const timestamp = fourMonthsAgo.getTime() / 1000;
      expect(isWithinThreeMonths(timestamp)).toBe(false);
    });

    it('returns false for posts from 6 months ago', () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const timestamp = sixMonthsAgo.getTime() / 1000;
      expect(isWithinThreeMonths(timestamp)).toBe(false);
    });

    it('handles ISO string format', () => {
      const now = new Date();
      expect(isWithinThreeMonths(now.toISOString())).toBe(true);

      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
      expect(isWithinThreeMonths(fourMonthsAgo.toISOString())).toBe(false);
    });

    it('handles Unix timestamp as string', () => {
      const now = Date.now() / 1000;
      expect(isWithinThreeMonths(now.toString())).toBe(true);

      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
      const timestamp = fourMonthsAgo.getTime() / 1000;
      expect(isWithinThreeMonths(timestamp.toString())).toBe(false);
    });

    it('returns false for invalid date strings', () => {
      expect(isWithinThreeMonths('invalid')).toBe(false);
      expect(isWithinThreeMonths('not-a-date')).toBe(false);
    });

    it('handles edge case at exactly 3 months boundary', () => {
      const exactlyThreeMonths = new Date();
      exactlyThreeMonths.setMonth(exactlyThreeMonths.getMonth() - 3);
      const timestamp = exactlyThreeMonths.getTime() / 1000;
      // Should return true (posts from exactly 3 months ago or newer are included)
      expect(isWithinThreeMonths(timestamp)).toBe(true);
    });
  });
});
