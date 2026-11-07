import { ValidationError } from './errors/ValidationError';

export interface VoucherInfo {
  code: string;
  discountPercent: number;
  description: string;
}

const VOUCHER_MAP: Record<string, VoucherInfo> = {
  WELCOME10: { code: 'WELCOME10', discountPercent: 10, description: 'Giảm 10% cho đơn thuê' },
  GIAM10: { code: 'WELCOME10', discountPercent: 10, description: 'Giảm 10% cho đơn thuê' },
  SHOE20: { code: 'SHOE20', discountPercent: 20, description: 'Ưu đãi VIP giảm 20%' },
  VIP20: { code: 'SHOE20', discountPercent: 20, description: 'Ưu đãi VIP giảm 20%' },
  GIAM5: { code: 'GIAM5', discountPercent: 5, description: 'Giảm 5% phí thuê giày' },
  FREESHIP5: { code: 'GIAM5', discountPercent: 5, description: 'Giảm 5% phí thuê giày' },
};

export function resolveVoucher(rawCode?: string | null): VoucherInfo | null {
  if (!rawCode) return null;
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return null;

  const found = VOUCHER_MAP[normalized];
  if (!found) {
    throw new ValidationError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
  }

  return found;
}
