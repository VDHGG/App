import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { getDiscountPercentByRank } from '@domain/CustomerRank.enum';
import { resolveVoucher } from '@domain/Voucher.vo';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { ShoeRepository } from '@port/ShoeRepository.port';
import type { CreateRentalRequest } from './CreateRentalRequest.dto';
import type { CreateRentalResponse } from './CreateRentalResponse.dto';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

function getVietnamTodayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === 'month')?.value ?? String(now.getMonth() + 1).padStart(2, '0');
  const d = parts.find((p) => p.type === 'day')?.value ?? String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class CreateRentalService implements CreateRentalUseCase {
  private readonly customerRepository: CustomerRepository;
  private readonly shoeRepository: ShoeRepository;
  private readonly rentalRepository: RentalRepository;
  private readonly availabilityChecker: RentalAvailabilityChecker;
  private readonly idGenerator: IdGenerator;
  private readonly voucherRepository?: VoucherRepository;

  constructor(
    customerRepository: CustomerRepository,
    shoeRepository: ShoeRepository,
    rentalRepository: RentalRepository,
    availabilityChecker: RentalAvailabilityChecker,
    idGenerator: IdGenerator,
    voucherRepository?: VoucherRepository
  ) {
    this.customerRepository = customerRepository;
    this.shoeRepository = shoeRepository;
    this.rentalRepository = rentalRepository;
    this.availabilityChecker = availabilityChecker;
    this.idGenerator = idGenerator;
    this.voucherRepository = voucherRepository;
  }

  async execute(request: CreateRentalRequest): Promise<CreateRentalResponse> {
    const rentalPeriod = new RentalPeriod(request.startDate, request.endDate);
    const totalRequestedQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0);

    const customer = await this.customerRepository.findById(request.customerId);
    if (!customer) throw new NotFoundError('Customer', request.customerId);

    const rankDiscount = getDiscountPercentByRank(customer.rank);
    let appliedVoucherCode: string | null = null;
    let voucherDiscountPercent = 0;

    const trimmedCode = request.voucherCode?.trim();
    if (trimmedCode) {
      if (this.voucherRepository) {
        const normalized = trimmedCode.toUpperCase();
        const v = await this.voucherRepository.findByCode(normalized);
        const todayStr = getVietnamTodayYmd();
        const isValid =
          v &&
          v.isActive &&
          (!v.expiresAt || todayStr <= v.expiresAt) &&
          (v.maxUses === null || v.usedCount < v.maxUses);

        if (!isValid) {
          throw new ValidationError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
        }

        appliedVoucherCode = v.code;
        voucherDiscountPercent = v.discountPercent;
      } else {
        const v = resolveVoucher(trimmedCode);
        if (v) {
          appliedVoucherCode = v.code;
          voucherDiscountPercent = v.discountPercent;
        }
      }
    }

    const totalDiscountPercent = Math.min(50, rankDiscount + voucherDiscountPercent);

    const loadedShoes = new Map<string, Awaited<ReturnType<ShoeRepository['findByVariantId']>>>();
    const originalRentalItems: RentalItem[] = [];

    for (const requestedItem of request.items) {
      const shoe = await this.loadShoeForVariant(requestedItem.variantId, loadedShoes);
      if (!shoe) throw new NotFoundError('Variant', requestedItem.variantId);

      await this.availabilityChecker.ensureVariantAvailable(
        requestedItem.variantId,
        requestedItem.quantity,
        rentalPeriod
      );

      originalRentalItems.push(shoe.createRentalItem(requestedItem.variantId, requestedItem.quantity));
    }

    let finalRentalItems: RentalItem[];
    if (totalDiscountPercent > 0) {
      finalRentalItems = originalRentalItems.map(
        (item) =>
          new RentalItem({
            shoeId: item.shoeId,
            variantId: item.variantId,
            shoeName: item.shoeName,
            size: item.size,
            color: item.color,
            pricePerDay: Math.max(1, Math.round((item.pricePerDay * (100 - totalDiscountPercent)) / 100)),
            quantity: item.quantity,
          })
      );
    } else {
      finalRentalItems = originalRentalItems;
    }

    const originalBasePrice =
      originalRentalItems.reduce((sum, item) => sum + item.pricePerDay * item.quantity, 0) *
      rentalPeriod.durationInDays;

    let noteText = request.note?.trim() || '';
    if (totalDiscountPercent > 0) {
      const tagParts: string[] = [];
      if (rankDiscount > 0) {
        tagParts.push(`Hạng ${customer.rank} -${rankDiscount}%`);
      }
      if (appliedVoucherCode) {
        tagParts.push(`Voucher ${appliedVoucherCode} -${voucherDiscountPercent}%`);
      }
      const tag = `[Ưu đãi: ${tagParts.join(', ')}]`;
      if (noteText) {
        const maxPrefixLen = Math.max(0, 255 - tag.length - 1);
        const safePrefix =
          noteText.length > maxPrefixLen ? noteText.slice(0, maxPrefixLen).trimEnd() : noteText;
        noteText = safePrefix ? `${safePrefix} ${tag}` : tag;
      } else {
        noteText = tag;
      }
    }

    const rental = new Rental({
      id: this.idGenerator.next(),
      customerId: customer.id,
      items: finalRentalItems,
      period: rentalPeriod,
      note: noteText || null,
    });

    customer.registerRental(totalRequestedQuantity);

    await this.customerRepository.save(customer);
    await this.rentalRepository.save(rental);

    if (appliedVoucherCode && this.voucherRepository) {
      await this.voucherRepository.incrementUsedCount(appliedVoucherCode);
    }

    const discountAmount = Math.max(0, originalBasePrice - rental.basePrice);

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems: rental.totalItems,
      basePrice: rental.basePrice,
      totalAmount: rental.totalAmount,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      originalBasePrice,
      discountPercent: totalDiscountPercent,
      discountAmount,
      customerRank: customer.rank,
      appliedVoucher: appliedVoucherCode,
    };
  }

  private async loadShoeForVariant(
    variantId: string,
    loadedShoes: Map<string, Awaited<ReturnType<ShoeRepository['findByVariantId']>>>
  ) {
    for (const shoe of loadedShoes.values()) {
      if (shoe && shoe.findVariantById(variantId)) {
        return shoe;
      }
    }

    const shoe = await this.shoeRepository.findByVariantId(variantId);

    if (shoe) {
      loadedShoes.set(shoe.id, shoe);
    }

    return shoe;
  }
}
