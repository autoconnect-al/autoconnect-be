import { access, mkdir, mkdtemp, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { ApMaintenanceCronService } from './ap-maintenance-cron.service';
import { ApPostToolingService } from './ap-post-tooling.service';

describe('ApMaintenanceCronService', () => {
  const originalMediaRoot = process.env.MEDIA_ROOT;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const createdDirs: string[] = [];

  const makeService = (
    autoRenewPosts: jest.Mock,
  ): ApMaintenanceCronService =>
    new ApMaintenanceCronService({
      autoRenewPosts,
    } as unknown as ApPostToolingService);

  async function createTempDir(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    createdDirs.push(directory);
    return directory;
  }

  afterEach(async () => {
    process.env.MEDIA_ROOT = originalMediaRoot;
    process.env.UPLOAD_DIR = originalUploadDir;

    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (!dir) continue;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('calls autoRenewPosts once', async () => {
    const autoRenewPosts = jest.fn().mockResolvedValue({
      success: true,
      statusCode: '200',
      message: 'ok',
      result: null,
    });
    const service = makeService(autoRenewPosts);

    await service.runAutoRenewAtMidnight();

    expect(autoRenewPosts).toHaveBeenCalledTimes(1);
  });

  it('swallows auto-renew failures', async () => {
    const autoRenewPosts = jest
      .fn()
      .mockRejectedValue(new Error('renew failed'));
    const service = makeService(autoRenewPosts);

    await expect(service.runAutoRenewAtMidnight()).resolves.toBeUndefined();
    expect(autoRenewPosts).toHaveBeenCalledTimes(1);
  });

  it('deletes only old image files from MEDIA_ROOT/tmp', async () => {
    const mediaRoot = await createTempDir('ap-maintenance-media-root-');
    process.env.MEDIA_ROOT = mediaRoot;

    const uploadDir = await createTempDir('ap-maintenance-upload-dir-');
    process.env.UPLOAD_DIR = uploadDir;

    const mediaTmpRoot = resolve(mediaRoot, 'tmp');
    const uploadTmpRoot = resolve(uploadDir, 'tmp');
    await mkdir(mediaTmpRoot, { recursive: true });
    await mkdir(uploadTmpRoot, { recursive: true });

    const now = Date.now();
    const oldDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const recentDate = new Date(now - 2 * 60 * 60 * 1000);

    const oldImagePath = resolve(mediaTmpRoot, 'old-image.webp');
    const recentImagePath = resolve(mediaTmpRoot, 'recent-image.webp');
    const oldNonImagePath = resolve(mediaTmpRoot, 'old-note.txt');
    const oldUploadPath = resolve(uploadTmpRoot, 'upload-old.webp');

    await writeFile(oldImagePath, 'old image');
    await writeFile(recentImagePath, 'recent image');
    await writeFile(oldNonImagePath, 'old note');
    await writeFile(oldUploadPath, 'old upload image');

    await utimes(oldImagePath, oldDate, oldDate);
    await utimes(recentImagePath, recentDate, recentDate);
    await utimes(oldNonImagePath, oldDate, oldDate);
    await utimes(oldUploadPath, oldDate, oldDate);

    const service = makeService(jest.fn());
    await service.cleanupTmpImagesAtMidnight();

    await expect(access(oldImagePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(recentImagePath)).resolves.toBeUndefined();
    await expect(access(oldNonImagePath)).resolves.toBeUndefined();
    await expect(access(oldUploadPath)).resolves.toBeUndefined();
  });

  it('handles missing MEDIA_ROOT/tmp directory', async () => {
    const mediaRoot = await createTempDir('ap-maintenance-missing-tmp-');
    process.env.MEDIA_ROOT = mediaRoot;

    const service = makeService(jest.fn());

    await expect(service.cleanupTmpImagesAtMidnight()).resolves.toBeUndefined();
  });
});
