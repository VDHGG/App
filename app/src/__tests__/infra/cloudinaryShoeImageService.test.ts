import { existsSync } from 'node:fs';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudinaryShoeImageService,
  DEFAULT_SHOE_IMAGE_PUBLIC_ID,
  DEFAULT_STATIC_SHOE_IMAGE,
} from '@adapter/cloudinary/CloudinaryShoeImageService.adapter';
import { UploadShoeImageService } from '@usecase/UploadShoeImage.service';

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');

const SEEDED_PUBLIC_IDS = [
  'nike_pegasus40',
  'adidas_ultraboost',
  'adidas_future7',
  'nike_lebron21',
  'nike_vaporfly3',
  'adidas_light',
  'adidas_future_ult',
  'nike_kyrie',
  'newbalance_freshfoam',
  'asics_gelkayano',
  'converse_chuck70',
  'vans_oldskool',
  'hoka_carbonx',
  'puma_suede',
  'reebok_nanox4',
];

describe('CloudinaryShoeImageService static fallback & resilience', () => {
  let prevCloudName: string | undefined;
  let prevApiKey: string | undefined;
  let prevApiSecret: string | undefined;

  beforeEach(() => {
    prevCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    prevApiKey = process.env.CLOUDINARY_API_KEY;
    prevApiSecret = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = prevCloudName;

    if (prevApiKey === undefined) delete process.env.CLOUDINARY_API_KEY;
    else process.env.CLOUDINARY_API_KEY = prevApiKey;

    if (prevApiSecret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = prevApiSecret;
  });

  it('maps every seeded publicId to an existing slug file in public/images even when CLOUDINARY_CLOUD_NAME is set', () => {
    const service = new CloudinaryShoeImageService();

    for (const cloudName of ['', 'broken-prod-cloud']) {
      if (cloudName) process.env.CLOUDINARY_CLOUD_NAME = cloudName;
      else delete process.env.CLOUDINARY_CLOUD_NAME;

      for (const publicId of SEEDED_PUBLIC_IDS) {
        const expectedUrl = `/images/${publicId}.webp`;
        expect(service.urlForCard(publicId)).toBe(expectedUrl);
        expect(service.urlForDetail(publicId)).toBe(expectedUrl);
        expect(existsSync(path.join(PUBLIC_ROOT, 'images', `${publicId}.webp`))).toBe(true);
      }
    }
  });

  it('returns default_shoe.webp for null, empty, unknown, or prototype-named publicIds when Cloudinary is unconfigured', () => {
    const service = new CloudinaryShoeImageService();

    for (const id of [null, '', '   ', 'unknown_shoe', 'toString']) {
      expect(service.urlForCard(id)).toBe(DEFAULT_STATIC_SHOE_IMAGE);
      expect(service.urlForDetail(id)).toBe(DEFAULT_STATIC_SHOE_IMAGE);
    }

    expect(existsSync(path.join(PUBLIC_ROOT, 'images', 'default_shoe.webp'))).toBe(true);
  });

  it('uses Cloudinary URLs only for non-static publicIds when CLOUDINARY_CLOUD_NAME is configured', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    const service = new CloudinaryShoeImageService();

    const cardUrl = service.urlForCard('shoe-rental/shoes/sample');
    const detailUrl = service.urlForDetail('shoe-rental/shoes/sample');

    expect(cardUrl).toContain('https://res.cloudinary.com/demo-cloud/');
    expect(cardUrl).toContain('w_400');
    expect(detailUrl).toContain('https://res.cloudinary.com/demo-cloud/');
    expect(detailUrl).toContain('w_1200');
    expect(service.urlForCard(null)).toBe(DEFAULT_STATIC_SHOE_IMAGE);
  });

  it('falls back to default_shoe on upload when Cloudinary is unconfigured or upload fails', async () => {
    const service = new CloudinaryShoeImageService();
    const uploadUseCase = new UploadShoeImageService(service);
    const buf = Buffer.from('fake-webp-bytes');

    const unconfiguredRes = await uploadUseCase.execute({ buffer: buf, mimeType: 'image/webp' });
    expect(unconfiguredRes).toEqual({
      publicId: DEFAULT_SHOE_IMAGE_PUBLIC_ID,
      imageUrlCard: DEFAULT_STATIC_SHOE_IMAGE,
      imageUrlDetail: DEFAULT_STATIC_SHOE_IMAGE,
    });

    process.env.CLOUDINARY_CLOUD_NAME = 'broken-cloud';
    process.env.CLOUDINARY_API_KEY = 'bad-key';
    process.env.CLOUDINARY_API_SECRET = 'bad-secret';
    vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValueOnce(new Error('Invalid Signature'));

    const failedUploadRes = await uploadUseCase.execute({ buffer: buf, mimeType: 'image/webp' });
    expect(failedUploadRes).toEqual({
      publicId: DEFAULT_SHOE_IMAGE_PUBLIC_ID,
      imageUrlCard: DEFAULT_STATIC_SHOE_IMAGE,
      imageUrlDetail: DEFAULT_STATIC_SHOE_IMAGE,
    });
  });

  it('skips Cloudinary destroy for static seed and fallback publicIds', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
    const destroySpy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

    const service = new CloudinaryShoeImageService();
    await service.destroyByPublicId('nike_pegasus40');
    await service.destroyByPublicId(DEFAULT_SHOE_IMAGE_PUBLIC_ID);

    expect(destroySpy).not.toHaveBeenCalled();
  });
});
