import type { ListWishlistResponse } from './WishlistResponse.dto';

export interface WishlistUseCase {
  listForCustomer(customerId: string): Promise<ListWishlistResponse>;
  getShoeIds(customerId: string): Promise<{ shoeIds: string[] }>;
  add(customerId: string, shoeId: string): Promise<void>;
  remove(customerId: string, shoeId: string): Promise<void>;
  clear(customerId: string): Promise<void>;
}
