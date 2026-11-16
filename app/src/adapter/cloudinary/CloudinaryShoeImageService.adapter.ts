import { v2 as cloudinary } from 'cloudinary';
import type { ShoeImageServicePort, ShoeImageUploadResult } from '@port/ShoeImageService.port';

const FOLDER = 'shoe-rental/shoes';

const CARD_TRANSFORM = { fetch_format: 'auto' as const, quality: 'auto' as const, width: 400, crop: 'limit' as const };
const DETAIL_TRANSFORM = {
  fetch_format: 'auto' as const,
  quality: 'auto' as const,
  width: 1200,
  crop: 'limit' as const,
};

export const DEFAULT_SHOE_IMAGE_PUBLIC_ID = 'default_shoe';
export const DEFAULT_STATIC_SHOE_IMAGE = `/images/${DEFAULT_SHOE_IMAGE_PUBLIC_ID}.webp`;

const STATIC_SHOE_IMAGE_IDS = new Set<string>([
  DEFAULT_SHOE_IMAGE_PUBLIC_ID,
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
]);

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export class CloudinaryShoeImageService implements ShoeImageServicePort {
  private getCredentials(): CloudinaryCredentials | null {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? '';
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? '';
    if (!cloudName || !apiKey || !apiSecret) {
      return null;
    }
    return { cloudName, apiKey, apiSecret };
  }

  async uploadFromBuffer(buffer: Buffer, mimeType: string): Promise<ShoeImageUploadResult> {
    const creds = this.getCredentials();
    // shortcut: fallback to static default_shoe when Cloudinary credentials are missing or upload fails; revisit when Cloudinary is healthy
    if (!creds) {
      return { publicId: DEFAULT_SHOE_IMAGE_PUBLIC_ID };
    }
    try {
      cloudinary.config({
        cloud_name: creds.cloudName,
        api_key: creds.apiKey,
        api_secret: creds.apiSecret,
        secure: true,
      });
      const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: FOLDER,
        resource_type: 'image',
        overwrite: false,
      });
      return { publicId: (result.public_id as string | undefined)?.trim() || DEFAULT_SHOE_IMAGE_PUBLIC_ID };
    } catch {
      return { publicId: DEFAULT_SHOE_IMAGE_PUBLIC_ID };
    }
  }

  async destroyByPublicId(publicId: string): Promise<void> {
    const key = publicId.trim();
    if (!key || STATIC_SHOE_IMAGE_IDS.has(key)) {
      return;
    }
    const creds = this.getCredentials();
    if (!creds) {
      return;
    }
    try {
      cloudinary.config({
        cloud_name: creds.cloudName,
        api_key: creds.apiKey,
        api_secret: creds.apiSecret,
        secure: true,
      });
      await cloudinary.uploader.destroy(key, { resource_type: 'image', invalidate: true });
    } catch (err) {
      void err;
    }
  }

  private resolveUrl(
    publicId: string | null,
    transformation: typeof CARD_TRANSFORM | typeof DETAIL_TRANSFORM
  ): string {
    const key = publicId?.trim() ?? '';
    if (!key) {
      return DEFAULT_STATIC_SHOE_IMAGE;
    }
    if (STATIC_SHOE_IMAGE_IDS.has(key)) {
      return `/images/${key}.webp`;
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
    if (!cloudName) {
      return DEFAULT_STATIC_SHOE_IMAGE;
    }
    return cloudinary.url(key, {
      cloud_name: cloudName,
      secure: true,
      transformation: [transformation],
    });
  }

  urlForCard(publicId: string | null): string | null {
    return this.resolveUrl(publicId, CARD_TRANSFORM);
  }

  urlForDetail(publicId: string | null): string | null {
    return this.resolveUrl(publicId, DETAIL_TRANSFORM);
  }
}
