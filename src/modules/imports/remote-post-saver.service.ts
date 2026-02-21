import { Injectable } from '@nestjs/common';
import { requireEnv } from '../../common/require-env.util';

type Post = {
  pk?: number;
  caption?: string;
  like_count?: number;
  comment_count?: number;
  carousel_media?: Array<{
    pk: number;
    media_type: number;
    image_versions2?: { candidates?: { url?: string }[] };
  }>;
  product_type?: string;
  origin?: string; // "ENCAR"
  date?: number;
  taken_at?: number;
  user?: { pk?: number };
  [key: string]: any;
};

@Injectable()
export class RemotePostSaverService {
  // keep same defaults as your script; you can move these to env later
  private readonly basePath = requireEnv('AUTOCONNECT_BASE_URL');
  private readonly code = requireEnv('AUTOCONNECT_CODE');

  // Import your existing PostModel from your project (same as save-post.ts)
  // Adjust the path to wherever you keep it in Nest.

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-member-access
  private readonly PostModel = require('./types/instagram').PostModel;

  async getJwt(): Promise<string> {
    const resp = await fetch(
      `${this.basePath}/authentication/login-with-code?code=${this.code}`,
    );
    if (!resp.ok) {
      throw new Error(`Login failed: ${resp.status} ${resp.statusText}`);
    }
    const data = (await resp.json()) as { result?: string };
    if (!data?.result) throw new Error('Login succeeded but no JWT returned');
    return data.result;
    // This matches your script’s behavior:
    // GET `${basePath}/authentication/login-with-code?code=${code}` then jwt = result
  }

  async savePost(post: Post, jwt: string): Promise<string> {
    // Keep script gate:
    if (
      post['product_type'] !== 'carousel_container' &&
      post['origin'] !== 'ENCAR'
    )
      return 'skipped';

    let postToSave = post;

    // Same mapping as save-post.ts for non-ENCAR
    if (post.origin !== 'ENCAR') {
      postToSave = JSON.parse(JSON.stringify(this.PostModel)) as Post;
      postToSave.id = post.pk;
      postToSave.createdTime = post.date
        ? (new Date(post.date).getTime() / 1000).toString()
        : '';
      postToSave.caption = post.caption ?? '';
      postToSave.likesCount = post.like_count;
      postToSave.commentsCount = post.comment_count;

      postToSave.sidecarMedias = post.carousel_media
        ?.filter((m) => m.media_type === 1)
        .map((m) => ({
          id: m.pk,
          imageStandardResolutionUrl:
            m.image_versions2?.candidates?.[0]?.url ?? '',
          type: 'image',
        }))
        .filter(
          (m: { imageStandardResolutionUrl: string }) =>
            m.imageStandardResolutionUrl !== '',
        );
    }

    const body = {
      post: postToSave,
      vendorId: post.user?.pk ?? 1,
    };

    // Same request as script (note header name):
    const response = await fetch(
      `${this.basePath}/post/save-post?code=${this.code}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Http-Authorization': 'Bearer ' + jwt,
        },
        body: JSON.stringify(body),
      },
    ).catch((e) => {
      // script catches errors per request
      console.error(e);
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await response?.json();
    return JSON.stringify(json);
  }
}
