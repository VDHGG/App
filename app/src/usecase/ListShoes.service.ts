import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ListShoesResponse } from './ListShoesResponse.dto';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';

export class ListShoesService implements ListShoesUseCase {
  private readonly shoeRepository: ShoeRepository;

  constructor(shoeRepository: ShoeRepository) {
    this.shoeRepository = shoeRepository;
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
      })),
    };
  }
}
