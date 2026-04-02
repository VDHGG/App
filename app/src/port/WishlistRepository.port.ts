export type WishlistEntry = {
  shoeId: string;
  createdAt: Date;
};

export interface WishlistRepository {
  add(customerId: string, shoeId: string): Promise<void>;
  remove(customerId: string, shoeId: string): Promise<void>;
  clear(customerId: string): Promise<void>;
  /** Newest first. */
  listOrdered(customerId: string): Promise<WishlistEntry[]>;
  /** All shoe ids saved by the customer (including inactive shoes). */
  listShoeIds(customerId: string): Promise<string[]>;
}
