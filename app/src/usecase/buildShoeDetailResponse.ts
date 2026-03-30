import type { Shoe } from '@domain/Shoe.aggregate';
import type { ShoeImageServicePort } from '@port/ShoeImageService.port';
import type { CatalogLookupPort } from '@port/CatalogLookup.port';
import type { GetShoeResponse } from './GetShoeResponse.dto';

export async function buildShoeDetailResponse(
  shoe: Shoe,
  images: ShoeImageServicePort,
  catalog: CatalogLookupPort
): Promise<GetShoeResponse> {
  const catalogIds = await catalog.getShoeCatalogIds(shoe.id);

  return {
    shoeId: shoe.id,
    name: shoe.name,
    brand: shoe.brand,
    category: shoe.category,
    brandId: catalogIds?.brandId ?? null,
    categoryId: catalogIds?.categoryId ?? null,
    description: shoe.description,
    pricePerDay: shoe.pricePerDay,
    isActive: shoe.isActive,
    imagePublicId: shoe.imagePublicId,
    imageUrlCard: images.urlForCard(shoe.imagePublicId),
    imageUrlDetail: images.urlForDetail(shoe.imagePublicId),
    variants: shoe.variants.map((v) => {
      const colorId =
        catalogIds?.variants.find((x) => x.variantId === v.id)?.colorId ?? null;
      return {
        variantId: v.id,
        size: v.size,
        color: v.color,
        colorId,
        totalQuantity: v.totalQuantity,
        availableQuantity: v.availableQuantity,
      };
    }),
  };
}
