import type {
  SaveVoucherInput,
  VoucherRecord,
  VoucherRepository,
} from '@port/VoucherRepository.port';
import { ValidationError } from '@domain/errors/ValidationError';

export class InMemoryVoucherRepository implements VoucherRepository {
  private readonly store = new Map<string, VoucherRecord>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const defaults = [
      { code: 'WELCOME10', discountPercent: 10, description: 'Giảm 10% cho đơn thuê' },
      { code: 'GIAM10', discountPercent: 10, description: 'Giảm 10% cho đơn thuê' },
      { code: 'SHOE20', discountPercent: 20, description: 'Ưu đãi VIP giảm 20%' },
      { code: 'VIP20', discountPercent: 20, description: 'Ưu đãi VIP giảm 20%' },
      { code: 'GIAM5', discountPercent: 5, description: 'Giảm 5% phí thuê giày' },
      { code: 'FREESHIP5', discountPercent: 5, description: 'Giảm 5% phí thuê giày' },
    ];

    const now = new Date().toISOString();
    for (const d of defaults) {
      this.store.set(d.code, {
        code: d.code,
        discountPercent: d.discountPercent,
        description: d.description,
        isActive: true,
        maxUses: null,
        usedCount: 0,
        expiresAt: null,
        createdAt: now,
      });
    }
  }

  async findByCode(code: string): Promise<VoucherRecord | null> {
    const key = code.trim().toUpperCase();
    const item = this.store.get(key);
    return item ? { ...item } : null;
  }

  async listAll(): Promise<VoucherRecord[]> {
    return Array.from(this.store.values()).map((v) => ({ ...v }));
  }

  async listActive(todayDateStr: string): Promise<VoucherRecord[]> {
    return Array.from(this.store.values())
      .filter((v) => {
        if (!v.isActive) return false;
        if (v.expiresAt && v.expiresAt < todayDateStr) return false;
        if (v.maxUses !== null && v.usedCount >= v.maxUses) return false;
        return true;
      })
      .map((v) => ({ ...v }));
  }

  async save(input: SaveVoucherInput): Promise<VoucherRecord> {
    const code = input.code.trim().toUpperCase();
    const existing = this.store.get(code);
    const record: VoucherRecord = {
      code,
      discountPercent: input.discountPercent,
      description: input.description,
      isActive: input.isActive,
      maxUses: input.maxUses,
      usedCount: existing ? existing.usedCount : 0,
      expiresAt: input.expiresAt,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };
    this.store.set(code, record);
    return { ...record };
  }

  async incrementUsedCount(code: string): Promise<void> {
    const key = code.trim().toUpperCase();
    const existing = this.store.get(key);
    if (
      !existing ||
      !existing.isActive ||
      (existing.maxUses !== null && existing.usedCount >= existing.maxUses)
    ) {
      throw new ValidationError('Mã giảm giá đã hết lượt sử dụng hoặc không còn hiệu lực.');
    }
    existing.usedCount += 1;
  }

  async decrementUsedCount(code: string): Promise<void> {
    const key = code.trim().toUpperCase();
    const existing = this.store.get(key);
    if (existing && existing.usedCount > 0) {
      existing.usedCount -= 1;
    }
  }

  async deleteByCode(code: string): Promise<boolean> {
    const key = code.trim().toUpperCase();
    return this.store.delete(key);
  }
}
