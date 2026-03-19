import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { AddShoeRequest } from './AddShoeRequest.dto';
import type { AddShoeResponse } from './AddShoeResponse.dto';
import type { AddShoeUseCase } from '@usecase/AddShoeUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';

export class AddShoeService implements AddShoeUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly idGenerator: IdGenerator;

  constructor(shoeRepository: ShoeRepository, idGenerator: IdGenerator) {
    this.shoeRepository = shoeRepository;
    this.idGenerator = idGenerator;
  }

  async execute(request: AddShoeRequest): Promise<AddShoeResponse> {
    if (!request.variants || request.variants.length === 0) {
      throw new ValidationError('At least one variant is required.');
    }

    // Shoe constructor validates name, brand, pricePerDay
    const shoe = new Shoe({
      id: this.idGenerator.next(),
      name: request.name,
      brand: request.brand,
      category: request.category,
      description: request.description,
      pricePerDay: request.pricePerDay,
    });

    for (const variantRequest of request.variants) {
      shoe.addVariant(
        new ShoeVariant({
          id: this.idGenerator.next(),
          size: variantRequest.size,
          color: variantRequest.color,
          totalQuantity: variantRequest.totalQuantity,
        })
      );
    }

    await this.shoeRepository.save(shoe);

    return {
      shoeId: shoe.id,
      name: shoe.name,
      brand: shoe.brand,
      category: shoe.category,
      pricePerDay: shoe.pricePerDay,
      variantCount: shoe.variants.length,
      variantIds: shoe.variants.map((v) => v.id),
    };
  }
}
