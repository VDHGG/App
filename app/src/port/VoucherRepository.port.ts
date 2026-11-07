export interface VoucherRecord {
  code: string;
  discountPercent: number;
  description: string;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface SaveVoucherInput {
  code: string;
  discountPercent: number;
  description: string;
  isActive: boolean;
  maxUses: number | null;
  expiresAt: string | null;
}

export interface VoucherRepository {
  findByCode(code: string): Promise<VoucherRecord | null>;
  listAll(): Promise<VoucherRecord[]>;
  listActive(todayDateStr: string): Promise<VoucherRecord[]>;
  save(input: SaveVoucherInput): Promise<VoucherRecord>;
  incrementUsedCount(code: string): Promise<void>;
  decrementUsedCount(code: string): Promise<void>;
  deleteByCode(code: string): Promise<boolean>;
}
