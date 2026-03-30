import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { CatalogLookupPort } from '@port/CatalogLookup.port';
import type { GetShoeRequest } from './GetShoeRequest.dto';
import type { GetShoeResponse } from './GetShoeResponse.dto';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import { buildShoeDetailResponse } from './buildShoeDetailResponse';

export class GetShoeService implements GetShoeUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly shoeImages: ShoeImageServicePort;
  private readonly catalog: CatalogLookupPort;

  constructor(
    shoeRepository: ShoeRepository,
    shoeImages: ShoeImageServicePort,
    catalog: CatalogLookupPort
  ) {
    this.shoeRepository = shoeRepository;
    this.shoeImages = shoeImages;
    this.catalog = catalog;
  }

  async execute(request: GetShoeRequest): Promise<GetShoeResponse> {
    if (!request.shoeId || request.shoeId.trim().length === 0) {
      throw new ValidationError('Shoe id is required.');
    }

    const shoe = await this.shoeRepository.findById(request.shoeId);

    if (!shoe) {
      throw new NotFoundError('Shoe', request.shoeId);
    }

    return buildShoeDetailResponse(shoe, this.shoeImages, this.catalog);
  }
}
