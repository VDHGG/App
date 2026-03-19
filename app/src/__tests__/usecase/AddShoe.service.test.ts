import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryShoeRepository } from '@adapter/persistence/InMemoryShoeRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { AddShoeService } from '@usecase/AddShoe.service';

let shoeRepo: InMemoryShoeRepository;
let service: AddShoeService;

beforeEach(() => {
  shoeRepo = new InMemoryShoeRepository();
  service = new AddShoeService(shoeRepo, new ShortIdGenerator('S'));
});


describe('AddShoeService - happy path', () => {
  it('creates a shoe with a single variant', async () => {
    const result = await service.execute({
      name: 'Adidas Speed Run',
      brand: 'Adidas',
      category: 'Running',
      pricePerDay: 10,
      variants: [{ size: 42, color: 'Black', totalQuantity: 5 }],
    });

    expect(result.name).toBe('Adidas Speed Run');
    expect(result.brand).toBe('Adidas');
    expect(result.pricePerDay).toBe(10);
    expect(result.variantCount).toBe(1);
    expect(result.shoeId).toBeTruthy();
  });

  it('creates a shoe with multiple variants', async () => {
    const result = await service.execute({
      name: 'Nike Air Zoom',
      brand: 'Nike',
      category: 'Running',
      pricePerDay: 12,
      variants: [
        { size: 41, color: 'White', totalQuantity: 3 },
        { size: 42, color: 'Black', totalQuantity: 5 },
        { size: 43, color: 'Blue',  totalQuantity: 4 },
      ],
    });

    expect(result.variantCount).toBe(3);
  });

  it('persists the shoe so it can be found by variant', async () => {
    const result = await service.execute({
      name: 'Puma Street Rider',
      brand: 'Puma',
      category: 'Sport',
      pricePerDay: 8,
      variants: [{ size: 40, color: 'Brown', totalQuantity: 2 }],
    });

    const shoe = await shoeRepo['store']?.get(result.shoeId);
    expect(shoe?.name).toBe('Puma Street Rider');
    expect(shoe?.variants.length).toBe(1);
  });

  it('generates unique IDs for shoe and each variant', async () => {
    await service.execute({
      name: 'Shoe A',
      brand: 'Brand',
      category: 'Cat',
      pricePerDay: 5,
      variants: [
        { size: 40, color: 'Red',  totalQuantity: 1 },
        { size: 41, color: 'Blue', totalQuantity: 1 },
      ],
    });

    const result2 = await service.execute({
      name: 'Shoe B',
      brand: 'Brand',
      category: 'Cat',
      pricePerDay: 5,
      variants: [{ size: 42, color: 'Green', totalQuantity: 1 }],
    });

    expect(result2.shoeId).toBeTruthy();
  });
});


describe('AddShoeService - error cases', () => {
  it('throws when no variants are provided', async () => {
    await expect(
      service.execute({
        name: 'Empty Shoe',
        brand: 'B',
        category: 'C',
        pricePerDay: 5,
        variants: [],
      })
    ).rejects.toThrow('At least one variant is required');
  });

  it('throws when name is empty (domain validation)', async () => {
    await expect(
      service.execute({
        name: '',
        brand: 'B',
        category: 'C',
        pricePerDay: 5,
        variants: [{ size: 42, color: 'Black', totalQuantity: 1 }],
      })
    ).rejects.toThrow();
  });

  it('throws when pricePerDay is zero (domain validation)', async () => {
    await expect(
      service.execute({
        name: 'Shoe',
        brand: 'B',
        category: 'C',
        pricePerDay: 0,
        variants: [{ size: 42, color: 'Black', totalQuantity: 1 }],
      })
    ).rejects.toThrow('Price per day must be greater than 0');
  });

  it('throws when two variants share the same size+color (domain validation)', async () => {
    await expect(
      service.execute({
        name: 'Shoe',
        brand: 'B',
        category: 'C',
        pricePerDay: 5,
        variants: [
          { size: 42, color: 'Black', totalQuantity: 1 },
          { size: 42, color: 'Black', totalQuantity: 2 },
        ],
      })
    ).rejects.toThrow();
  });
});
