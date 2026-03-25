export type UploadShoeImageInput = {
  buffer: Buffer;
  mimeType: string;
};

export type UploadShoeImageResult = {
  publicId: string;
  imageUrlCard: string;
  imageUrlDetail: string;
};

export interface UploadShoeImageUseCase {
  execute(input: UploadShoeImageInput): Promise<UploadShoeImageResult>;
}
