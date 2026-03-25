import { v2 as cloudinary } from 'cloudinary';
import { BusinessRuleError } from '@domain/errors/BusinessRuleError';
import type { ShoeImageServicePort, ShoeImageUploadResult } from '@port/ShoeImageService.port';

const FOLDER = 'shoe-rental/shoes';

const CARD_TRANSFORM = { fetch_format: 'auto' as const, quality: 'auto' as const, width: 400, crop: 'limit' as const };
const DETAIL_TRANSFORM = {
  fetch_format: 'auto' as const,
  quality: 'auto' as const,
  width: 1200,
  crop: 'limit' as const,
};

export class CloudinaryShoeImageService implements ShoeImageServicePort {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      api_key: process.env.CLOUDINARY_API_KEY ?? '',
      api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
      secure: true,
    });
  }

  private ensureUploadConfigured(): void {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME?.trim() || !CLOUDINARY_API_KEY?.trim() || !CLOUDINARY_API_SECRET?.trim()) {
      throw new BusinessRuleError(
        'CLOUDINARY_NOT_CONFIGURED',
        'Image upload requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      );
    }
  }

  async uploadFromBuffer(buffer: Buffer, mimeType: string): Promise<ShoeImageUploadResult> {
    this.ensureUploadConfigured();
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: FOLDER,
      resource_type: 'image',
      overwrite: false,
    });
    return { publicId: result.public_id as string };
  }

  async destroyByPublicId(publicId: string): Promise<void> {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (
      !CLOUDINARY_CLOUD_NAME?.trim() ||
      !CLOUDINARY_API_KEY?.trim() ||
      !CLOUDINARY_API_SECRET?.trim()
    ) {
      return;
    }
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    } catch {
      
    }
  }

  urlForCard(publicId: string | null): string | null {
    if (!publicId) return null;
    if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) return null;
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [CARD_TRANSFORM],
    });
  }

  urlForDetail(publicId: string | null): string | null {
    if (!publicId) return null;
    if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) return null;
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [DETAIL_TRANSFORM],
    });
  }
}
