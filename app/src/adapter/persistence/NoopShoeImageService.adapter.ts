import type { ShoeImageServicePort, ShoeImageUploadResult } from '@port/ShoeImageService.port';

export class NoopShoeImageService implements ShoeImageServicePort {
  async uploadFromBuffer(): Promise<ShoeImageUploadResult> {
    throw new Error('Shoe image upload is not available in this environment.');
  }

  async destroyByPublicId(): Promise<void> {}

  urlForCard(publicId: string | null): string | null {
    return publicId ? `https://placeholder.invalid/card/${encodeURIComponent(publicId)}` : null;
  }

  urlForDetail(publicId: string | null): string | null {
    return publicId ? `https://placeholder.invalid/detail/${encodeURIComponent(publicId)}` : null;
  }
}
