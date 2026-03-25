export type ShoeImageUploadResult = {
  publicId: string;
};

export interface ShoeImageServicePort {
  uploadFromBuffer(buffer: Buffer, mimeType: string): Promise<ShoeImageUploadResult>;
  destroyByPublicId(publicId: string): Promise<void>;
  urlForCard(publicId: string | null): string | null;
  urlForDetail(publicId: string | null): string | null;
}
