import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { UploadShoeImageInput, UploadShoeImageResult, UploadShoeImageUseCase } from './UploadShoeImageUseCase.port';

export class UploadShoeImageService implements UploadShoeImageUseCase {
  private readonly images: ShoeImageServicePort;

  constructor(images: ShoeImageServicePort) {
    this.images = images;
  }

  async execute(input: UploadShoeImageInput): Promise<UploadShoeImageResult> {
    const { publicId } = await this.images.uploadFromBuffer(input.buffer, input.mimeType);
    const imageUrlCard = this.images.urlForCard(publicId);
    const imageUrlDetail = this.images.urlForDetail(publicId);
    if (!imageUrlCard || !imageUrlDetail) {
      throw new Error('Failed to build image URLs after upload.');
    }
    return { publicId, imageUrlCard, imageUrlDetail };
  }
}
