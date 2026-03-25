import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { ListShoesResponse } from './ListShoesResponse.dto';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';

export class ListShoesService implements ListShoesUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly shoeImages: ShoeImageServicePort;

  constructor(shoeRepository: ShoeRepository, shoeImages: ShoeImageServicePort) {
    this.shoeRepository = shoeRepository;
    this.shoeImages = shoeImages;
  }

  async execute(): Promise<ListShoesResponse> {
    const shoes = await this.shoeRepository.findAll();

    return {
      shoes: shoes.map((shoe) => ({
        shoeId: shoe.id,
        name: shoe.name,
        brand: shoe.brand,
        category: shoe.category,
        pricePerDay: shoe.pricePerDay,
        variantCount: shoe.variants.length,
        isActive: shoe.isActive,
        unitsInStock: shoe.variants.reduce((sum, v) => sum + v.totalQuantity, 0),
        imagePublicId: shoe.imagePublicId,
        imageUrl: this.shoeImages.urlForCard(shoe.imagePublicId),
      })),
    };
  }
}
