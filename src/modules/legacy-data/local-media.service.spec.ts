import { access, rm } from 'fs/promises';
import { resolve } from 'path';
import { LocalMediaService } from './local-media.service';

describe('LocalMediaService.uploadImage', () => {
  const mediaTmpRoot = resolve(process.cwd(), 'media', 'tmp');
  const outputId = 'har-upload-regression';
  const outputPath = resolve(mediaTmpRoot, `${outputId}.webp`);
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABBAEAff5QWQAAAABJRU5ErkJggg==';

  let service: LocalMediaService;

  beforeEach(() => {
    service = new LocalMediaService();
  });

  afterEach(async () => {
    await rm(outputPath, { force: true });
  });

  it('recovers malformed urlencoded json split at "=" and uploads image', async () => {
    const rawJson =
      `{"file":"data:image/png;base64,${tinyPngBase64}",` +
      `"filename":"1.png","id":"${outputId}"}`;
    const separatorIndex = rawJson.indexOf('=');
    const malformedBody = {
      [rawJson.slice(0, separatorIndex)]: rawJson.slice(separatorIndex + 1),
    };

    const response = await service.uploadImage(malformedBody);

    expect(response).toMatchObject({
      success: true,
      result: `/media/tmp/${outputId}.webp`,
      statusCode: '200',
    });
    await expect(access(outputPath)).resolves.toBeUndefined();
  });
});
