import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { AddShoeService } from '@usecase/AddShoe.service';
import { DeactivateShoeService } from '@usecase/DeactivateShoe.service';

let shoeRepo: InMemoryShoeRepository;
let deactivate: DeactivateShoeService;

beforeEach(() => {
  shoeRepo = new InMemoryShoeRepository();
  deactivate = new DeactivateShoeService(shoeRepo);
});

describe('DeactivateShoeService', () => {
  it('sets shoe inactive', async () => {
    const add = new AddShoeService(shoeRepo, new ShortIdGenerator('S'));
    const created = await add.execute({
      name: 'X',
      brand: 'B',
      category: 'C',
      pricePerDay: 10,
      variants: [{ size: 40, color: 'Red', totalQuantity: 1 }],
    });

    const result = await deactivate.execute({ shoeId: created.shoeId });

    expect(result.isActive).toBe(false);
    const loaded = await shoeRepo.findById(created.shoeId);
    expect(loaded?.isActive).toBe(false);
  });
});
