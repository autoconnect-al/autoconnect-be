import {
  buildPostReviewSignaturePayload,
  signPostReviewRequest,
  verifyPostReviewRequestSignature,
} from './post-review-signature.util';

describe('post-review-signature.util', () => {
  beforeEach(() => {
    process.env.POST_REVIEWS_SIGNING_SECRET =
      process.env.POST_REVIEWS_SIGNING_SECRET?.trim() ||
      'unit-test-post-review-signing-secret';
  });

  it('builds deterministic payload', () => {
    const payload = buildPostReviewSignaturePayload({
      timestamp: '1710000000000',
      postId: '42',
      reviewType: 'like',
      reasonKey: 'good_price',
      message: 'Looks great',
      visitorId: 'visitor-1',
    });

    expect(payload).toBe(
      'ts=1710000000000&postId=42&reviewType=like&reasonKey=good_price&message=Looks+great&visitorId=visitor-1',
    );
  });

  it('verifies a valid signature', () => {
    const timestamp = Date.now().toString();
    const signature = signPostReviewRequest({
      timestamp,
      postId: '99',
      reviewType: 'dislike',
      reasonKey: 'price_too_high',
      message: 'Too expensive for this year',
      visitorId: 'visitor-2',
    });

    expect(
      verifyPostReviewRequestSignature({
        timestamp,
        signature,
        postId: '99',
        reviewType: 'dislike',
        reasonKey: 'price_too_high',
        message: 'Too expensive for this year',
        visitorId: 'visitor-2',
      }),
    ).toEqual({ valid: true });
  });

  it('rejects stale or missing signatures', () => {
    expect(
      verifyPostReviewRequestSignature({
        postId: '1',
        reviewType: 'like',
      }),
    ).toEqual({ valid: false, reason: 'missing' });

    const timestamp = (Date.now() - 120_000).toString();
    const signature = signPostReviewRequest({
      timestamp,
      postId: '1',
      reviewType: 'like',
      visitorId: 'visitor-1',
    });

    expect(
      verifyPostReviewRequestSignature({
        timestamp,
        signature,
        postId: '1',
        reviewType: 'like',
        visitorId: 'visitor-1',
      }),
    ).toEqual({ valid: false, reason: 'stale' });
  });
});
