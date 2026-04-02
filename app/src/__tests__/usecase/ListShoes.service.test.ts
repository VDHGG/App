import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { AddShoeService } from '@usecase/AddShoe.service';
import { NoopShoeImageService } from '@adapter/persistence/NoopShoeImageService.adapter';
import { ListShoesService } from '@usecase/ListShoes.service';

let shoeRepo: InMemoryShoeRepository;
let listShoes: ListShoesService;

beforeEach(() => {
  shoeRepo = new InMemoryShoeRepository();
  listShoes = new ListShoesService(shoeRepo, new NoopShoeImageService());
});

describe('ListShoesService', () => {
  it('returns empty list when no shoes', async () => {
    const result = await listShoes.execute();

    expect(result.shoes).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('returns all shoes with summary', async () => {
    const addShoe = new AddShoeService(shoeRepo, new ShortIdGenerator('S'));
    await addShoe.execute({
      name: 'Nike Air',
      brand: 'Nike',
      category: 'Running',
      pricePerDay: 10,
      variants: [{ size: 42, color: 'Black', totalQuantity: 5 }],
    });
    await addShoe.execute({
      name: 'Adidas Speed',
      brand: 'Adidas',
      category: 'Sport',
      pricePerDay: 8,
      variants: [
        { size: 40, color: 'White', totalQuantity: 2 },
        { size: 41, color: 'Blue', totalQuantity: 3 },
      ],
    });

    const result = await listShoes.execute();

    expect(result.shoes).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    const byName = Object.fromEntries(result.shoes.map((s) => [s.name, s]));
    expect(byName['Nike Air']).toMatchObject({
      brand: 'Nike',
      category: 'Running',
      pricePerDay: 10,
      variantCount: 1,
      isActive: true,
      unitsInStock: 5,
    });
    expect(byName['Adidas Speed']).toMatchObject({
      brand: 'Adidas',
      variantCount: 2,
      isActive: true,
      unitsInStock: 5,
    });
  });
});
