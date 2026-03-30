import type { UpdateShoeResponse } from './UpdateShoeResponse.dto';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { CatalogLookupPort } from '@port/CatalogLookup.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { UpdateShoeRequest } from './UpdateShoeRequest.dto';
import type { UpdateShoeUseCase } from './UpdateShoeUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import { buildShoeDetailResponse } from './buildShoeDetailResponse';

export class UpdateShoeService implements UpdateShoeUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly idGenerator: IdGenerator;
  private readonly shoeImages: ShoeImageServicePort;
  private readonly catalog: CatalogLookupPort;

  constructor(
    shoeRepository: ShoeRepository,
    idGenerator: IdGenerator,
    shoeImages: ShoeImageServicePort,
    catalog: CatalogLookupPort
  ) {
    this.shoeRepository = shoeRepository;
    this.idGenerator = idGenerator;
    this.shoeImages = shoeImages;
    this.catalog = catalog;
  }

  async execute(request: UpdateShoeRequest): Promise<UpdateShoeResponse> {
    const shoe = await this.shoeRepository.findById(request.shoeId);
    if (!shoe) {
      throw new NotFoundError('Shoe', request.shoeId);
    }

    const previousImagePublicId = shoe.imagePublicId;

    const hasPatch =
      request.name !== undefined ||
      request.brand !== undefined ||
      request.category !== undefined ||
      request.description !== undefined ||
      request.pricePerDay !== undefined ||
      request.isActive !== undefined ||
      request.imagePublicId !== undefined ||
      (request.variantQuantityUpdates && request.variantQuantityUpdates.length > 0) ||
      (request.newVariants && request.newVariants.length > 0);

    if (!hasPatch) {
      throw new ValidationError('No changes provided.');
    }

    if (request.imagePublicId !== undefined) {
      shoe.changeImagePublicId(request.imagePublicId);
    }

    if (request.name !== undefined) shoe.rename(request.name);
    if (request.brand !== undefined) shoe.changeBrand(request.brand);
    if (request.category !== undefined) shoe.changeCategory(request.category);
    if (request.description !== undefined) shoe.changeDescription(request.description);
    if (request.pricePerDay !== undefined) shoe.changePricePerDay(request.pricePerDay);
    if (request.isActive === true) shoe.activate();
    if (request.isActive === false) shoe.deactivate();

    for (const u of request.variantQuantityUpdates ?? []) {
      shoe.changeVariantOnHandQuantity(u.variantId, u.totalQuantity);
    }

    for (const nv of request.newVariants ?? []) {
      shoe.addVariant(
        new ShoeVariant({
          id: this.idGenerator.next(),
          size: nv.size,
          color: nv.color,
          totalQuantity: nv.totalQuantity,
        })
      );
    }

    await this.shoeRepository.save(shoe);
    const reloaded = await this.shoeRepository.findById(request.shoeId);
    const finalShoe = reloaded ?? shoe;

    if (previousImagePublicId && previousImagePublicId !== finalShoe.imagePublicId) {
      await this.shoeImages.destroyByPublicId(previousImagePublicId);
    }

    return buildShoeDetailResponse(finalShoe, this.shoeImages, this.catalog);
  }
}
