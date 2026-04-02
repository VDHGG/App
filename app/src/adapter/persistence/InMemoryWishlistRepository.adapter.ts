import type { WishlistEntry, WishlistRepository } from '@port/WishlistRepository.port';

/** Map key: `${customerId}::${shoeId}` */
export class InMemoryWishlistRepository implements WishlistRepository {
  private readonly rows = new Map<string, Date>();

  private key(customerId: string, shoeId: string): string {
    return `${customerId}::${shoeId}`;
  }

  async add(customerId: string, shoeId: string): Promise<void> {
    const k = this.key(customerId, shoeId);
    if (!this.rows.has(k)) {
      this.rows.set(k, new Date());
    }
  }

  async remove(customerId: string, shoeId: string): Promise<void> {
    this.rows.delete(this.key(customerId, shoeId));
  }

  async clear(customerId: string): Promise<void> {
    const prefix = `${customerId}::`;
    for (const k of this.rows.keys()) {
      if (k.startsWith(prefix)) this.rows.delete(k);
    }
  }

  async listOrdered(customerId: string): Promise<WishlistEntry[]> {
    const prefix = `${customerId}::`;
    const out: WishlistEntry[] = [];
    for (const [k, createdAt] of this.rows.entries()) {
      if (!k.startsWith(prefix)) continue;
      const shoeId = k.slice(prefix.length);
      out.push({ shoeId, createdAt: new Date(createdAt.getTime()) });
    }
    out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return out;
  }

  async listShoeIds(customerId: string): Promise<string[]> {
    const entries = await this.listOrdered(customerId);
    return entries.map((e) => e.shoeId);
  }
}
