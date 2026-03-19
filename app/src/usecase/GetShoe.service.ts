import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { GetShoeRequest } from './GetShoeRequest.dto';
import type { GetShoeResponse } from './GetShoeResponse.dto';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

export class GetShoeService implements GetShoeUseCase {
  private readonly shoeRepository: ShoeRepository;

  constructor(shoeRepository: ShoeRepository) {
    this.shoeRepository = shoeRepository;
  }

  async execute(request: GetShoeRequest): Promise<GetShoeResponse> {
    if (!request.shoeId || request.shoeId.trim().length === 0) {
      throw new ValidationError('Shoe id is required.');
    }

    const shoe = await this.shoeRepository.findById(request.shoeId);

    if (!shoe) {
      throw new NotFoundError('Shoe', request.shoeId);
    }

    return {
      shoeId: shoe.id,
      name: shoe.name,
      brand: shoe.brand,
      category: shoe.category,
      description: shoe.description,
      pricePerDay: shoe.pricePerDay,
      isActive: shoe.isActive,
      variants: shoe.variants.map((v) => ({
        variantId: v.id,
        size: v.size,
        color: v.color,
        totalQuantity: v.totalQuantity,
        availableQuantity: v.availableQuantity,
      })),
    };
  }
}
