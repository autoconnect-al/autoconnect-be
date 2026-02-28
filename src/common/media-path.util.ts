import { resolve } from 'path';

export function getMediaRootPath(): string {
  const configured = (process.env.MEDIA_ROOT ?? '').trim();
  if (configured) {
    return resolve(configured);
  }
  return resolve(process.cwd(), 'media');
}
