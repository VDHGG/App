import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { AddShoeService } from '@usecase/AddShoe.service';
import { NoopShoeImageService } from '@adapter/persistence/NoopShoeImageService.adapter';
import { GetShoeService } from '@usecase/GetShoe.service';

let shoeRepo: InMemoryShoeRepository;
let getShoe: GetShoeService;

beforeEach(() => {
  shoeRepo = new InMemoryShoeRepository();
  getShoe = new GetShoeService(shoeRepo, new NoopShoeImageService());
});

describe('GetShoeService', () => {
  it('returns shoe detail by id', async () => {
    const addShoe = new AddShoeService(shoeRepo, new ShortIdGenerator('S'));
    const created = await addShoe.execute({
      name: 'Nike Air',
      brand: 'Nike',
      category: 'Running',
      pricePerDay: 10,
      variants: [
        { size: 42, color: 'Black', totalQuantity: 5 },
        { size: 43, color: 'White', totalQuantity: 3 },
      ],
    });

    const result = await getShoe.execute({ shoeId: created.shoeId });

    expect(result.shoeId).toBe(created.shoeId);
    expect(result.name).toBe('Nike Air');
    expect(result.brand).toBe('Nike');
    expect(result.pricePerDay).toBe(10);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0]).toMatchObject({ size: 42, color: 'Black', totalQuantity: 5 });
  });

  it('throws when shoeId is empty', async () => {
    await expect(getShoe.execute({ shoeId: '' })).rejects.toThrow('Shoe id is required');
  });

  it('throws when shoe not found', async () => {
    await expect(getShoe.execute({ shoeId: 'GHOST' })).rejects.toThrow(/Shoe.*GHOST.*not found/);
  });
});
