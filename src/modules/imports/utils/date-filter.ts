/**
 * Utility functions for filtering posts by date
 */

// Timestamp threshold: Unix timestamps less than this are in seconds, >= are in milliseconds
// This value (10 billion) corresponds to Sept 2286, a reasonable cutoff
const TIMESTAMP_THRESHOLD_MS = 10000000000;

/**
 * Checks if a post is within the last 3 months
 * @param createdTime - Post creation time (ISO string or Unix timestamp in seconds)
 * @returns true if post is within 3 months, false otherwise
 */
export function isWithinThreeMonths(
  createdTime: string | number | undefined | null,
): boolean {
  if (!createdTime) return false;

  try {
    let postDate: Date;

    if (typeof createdTime === 'string') {
      // Check if it looks like an ISO string (contains - or T or Z)
      if (
        createdTime.includes('-') ||
        createdTime.includes('T') ||
        createdTime.includes('Z')
      ) {
        // ISO string
        postDate = new Date(createdTime);
      } else {
        // Try to parse as Unix timestamp (in seconds as string)
        const timestamp = parseFloat(createdTime);
        if (!isNaN(timestamp)) {
          if (timestamp < TIMESTAMP_THRESHOLD_MS) {
            // Unix timestamp in seconds
            postDate = new Date(timestamp * 1000);
          } else {
            // Unix timestamp in milliseconds
            postDate = new Date(timestamp);
          }
        } else {
          // Not a valid number, try as date string anyway
          postDate = new Date(createdTime);
        }
      }
    } else {
      // Numeric timestamp
      if (createdTime < TIMESTAMP_THRESHOLD_MS) {
        // Unix timestamp in seconds
        postDate = new Date(createdTime * 1000);
      } else {
        // Unix timestamp in milliseconds
        postDate = new Date(createdTime);
      }
    }

    // Check if date is valid
    if (isNaN(postDate.getTime())) {
      return false;
    }

    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    return postDate >= threeMonthsAgo;
  } catch (error) {
    console.error('Error checking date filter:', error);
    return false;
  }
}
