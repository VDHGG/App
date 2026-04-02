import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { WishlistRepository } from '@port/WishlistRepository.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import type { WishlistUseCase } from './WishlistUseCase.port';
import type { ListWishlistResponse } from './WishlistResponse.dto';

export class WishlistService implements WishlistUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly wishlistRepository: WishlistRepository;
  private readonly shoeImages: ShoeImageServicePort;

  constructor(
    shoeRepository: ShoeRepository,
    wishlistRepository: WishlistRepository,
    shoeImages: ShoeImageServicePort
  ) {
    this.shoeRepository = shoeRepository;
    this.wishlistRepository = wishlistRepository;
    this.shoeImages = shoeImages;
  }

  async listForCustomer(customerId: string): Promise<ListWishlistResponse> {
    const ordered = await this.wishlistRepository.listOrdered(customerId);
    const items: ListWishlistResponse['items'] = [];

    for (const entry of ordered) {
      const shoe = await this.shoeRepository.findById(entry.shoeId);
      if (!shoe || !shoe.isActive) continue;

      items.push({
        shoeId: shoe.id,
        name: shoe.name,
        brand: shoe.brand,
        category: shoe.category,
        pricePerDay: shoe.pricePerDay,
        imagePublicId: shoe.imagePublicId,
        imageUrl: this.shoeImages.urlForCard(shoe.imagePublicId),
        addedAt: entry.createdAt.toISOString(),
      });
    }

    return { items };
  }

  async getShoeIds(customerId: string): Promise<{ shoeIds: string[] }> {
    const shoeIds = await this.wishlistRepository.listShoeIds(customerId);
    return { shoeIds };
  }

  async add(customerId: string, shoeId: string): Promise<void> {
    const shoe = await this.shoeRepository.findById(shoeId);
    if (!shoe || !shoe.isActive) {
      throw new NotFoundError('Shoe', shoeId);
    }
    await this.wishlistRepository.add(customerId, shoe.id);
  }

  async remove(customerId: string, shoeId: string): Promise<void> {
    await this.wishlistRepository.remove(customerId, shoeId);
  }

  async clear(customerId: string): Promise<void> {
    await this.wishlistRepository.clear(customerId);
  }
}