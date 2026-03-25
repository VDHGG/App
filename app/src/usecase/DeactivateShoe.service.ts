import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { DeactivateShoeRequest } from './DeactivateShoeRequest.dto';
import type { DeactivateShoeResponse } from './DeactivateShoeResponse.dto';
import type { DeactivateShoeUseCase } from './DeactivateShoeUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

export class DeactivateShoeService implements DeactivateShoeUseCase {
  private readonly shoeRepository: ShoeRepository;

  constructor(shoeRepository: ShoeRepository) {
    this.shoeRepository = shoeRepository;
  }

  async execute(request: DeactivateShoeRequest): Promise<DeactivateShoeResponse> {
    if (!request.shoeId || request.shoeId.trim().length === 0) {
      throw new ValidationError('Shoe id is required.');
    }

    const shoe = await this.shoeRepository.findById(request.shoeId);
    if (!shoe) {
      throw new NotFoundError('Shoe', request.shoeId);
    }

    shoe.deactivate();
    await this.shoeRepository.save(shoe);

    return {
      shoeId: shoe.id,
      isActive: shoe.isActive,
    };
  }
}
