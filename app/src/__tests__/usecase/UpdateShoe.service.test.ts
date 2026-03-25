import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { AddShoeService } from '@usecase/AddShoe.service';
import { NoopShoeImageService } from '@adapter/persistence/NoopShoeImageService.adapter';
import { UpdateShoeService } from '@usecase/UpdateShoe.service';

let shoeRepo: InMemoryShoeRepository;
let update: UpdateShoeService;

beforeEach(() => {
  shoeRepo = new InMemoryShoeRepository();
  update = new UpdateShoeService(shoeRepo, new ShortIdGenerator('S'), new NoopShoeImageService());
});

describe('UpdateShoeService', () => {
  it('renames shoe and updates variant quantity', async () => {
    const add = new AddShoeService(shoeRepo, new ShortIdGenerator('S'));
    const created = await add.execute({
      name: 'Old',
      brand: 'B',
      category: 'C',
      pricePerDay: 10,
      variants: [{ size: 40, color: 'Red', totalQuantity: 10 }],
    });
    const variantId = created.variantIds[0];

    const result = await update.execute({
      shoeId: created.shoeId,
      name: 'New Name',
      variantQuantityUpdates: [{ variantId, totalQuantity: 8 }],
    });

    expect(result.name).toBe('New Name');
    const v = result.variants.find((x) => x.variantId === variantId);
    expect(v?.totalQuantity).toBe(8);
  });
});
