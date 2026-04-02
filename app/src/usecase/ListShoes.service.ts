import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import { normalizePage, normalizePageSize, totalPages } from '../lib/pagination';
import type { ListShoesRequest } from './ListShoesRequest.dto';
import type { ListShoesResponse } from './ListShoesResponse.dto';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';

export class ListShoesService implements ListShoesUseCase {
  private readonly shoeRepository: ShoeRepository;
  private readonly shoeImages: ShoeImageServicePort;

  constructor(shoeRepository: ShoeRepository, shoeImages: ShoeImageServicePort) {
    this.shoeRepository = shoeRepository;
    this.shoeImages = shoeImages;
  }

  async execute(request?: ListShoesRequest): Promise<ListShoesResponse> {
    const paginate = request?.page !== undefined;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : undefined;
    const offset = paginate ? (page - 1) * pageSize : undefined;

    const { priceBucket, stockBucket } = request ?? {};
    const { items, total } = await this.shoeRepository.findAll({
      ...(priceBucket !== undefined ? { priceBucket } : {}),
      ...(stockBucket !== undefined ? { stockBucket } : {}),
      ...(limit !== undefined ? { limit, offset } : {}),
    });

    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);

    return {
      shoes: items.map((shoe) => ({
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
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize),
    };
  }
}
