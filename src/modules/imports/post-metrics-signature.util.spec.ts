import {
  buildPostMetricSignaturePayload,
  signPostMetricRequest,
  verifyPostMetricRequestSignature,
} from './post-metrics-signature.util';

describe('post-metrics-signature.util', () => {
  beforeEach(() => {
    process.env.POST_METRICS_SIGNING_SECRET =
      'unit-test-post-metrics-signing-secret';
  });

  it('builds a stable canonical payload', () => {
    expect(
      buildPostMetricSignaturePayload({
        timestamp: '1710000000000',
        postId: '42',
        metric: 'contact',
        visitorId: 'visitor-1',
        contactMethod: 'call',
      }),
    ).toBe(
      'ts=1710000000000&postId=42&metric=contact&visitorId=visitor-1&contactMethod=call',
    );
  });

  it('accepts a valid signature inside the freshness window', () => {
    const timestamp = Date.now().toString();
    const signature = signPostMetricRequest({
      timestamp,
      postId: '42',
      metric: 'clicks',
      visitorId: 'visitor-1',
    });

    expect(
      verifyPostMetricRequestSignature({
        timestamp,
        signature,
        postId: '42',
        metric: 'clicks',
        visitorId: 'visitor-1',
      }),
    ).toEqual({ valid: true });
  });

  it('rejects stale timestamps', () => {
    const realNow = Date.now;
    const issuedAt = realNow().toString();
    const signature = signPostMetricRequest({
      timestamp: issuedAt,
      postId: '42',
      metric: 'clicks',
    });

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow() + 61_000);

    expect(
      verifyPostMetricRequestSignature({
        timestamp: issuedAt,
        signature,
        postId: '42',
        metric: 'clicks',
      }),
    ).toEqual({ valid: false, reason: 'stale' });

    nowSpy.mockRestore();
  });

  it('rejects invalid signatures', () => {
    expect(
      verifyPostMetricRequestSignature({
        timestamp: Date.now().toString(),
        signature: 'deadbeef',
        postId: '42',
        metric: 'clicks',
      }),
    ).toEqual({ valid: false, reason: 'invalid' });
  });
});
