import type { RentalRepository } from '@port/RentalRepository.port';
import type { RentalPaymentRepository } from '@port/RentalPaymentRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import { RentalStatus } from '@domain/RentalStatus.enum';

export class ExpirePendingOnlinePaymentsService {
  private readonly transactionManager: TransactionManager;
  private readonly rentalPayments: RentalPaymentRepository;
  private readonly rentals: RentalRepository;
  private readonly cancelRental: CancelRentalUseCase;

  constructor(
    transactionManager: TransactionManager,
    rentalPayments: RentalPaymentRepository,
    rentals: RentalRepository,
    cancelRental: CancelRentalUseCase
  ) {
    this.transactionManager = transactionManager;
    this.rentalPayments = rentalPayments;
    this.rentals = rentals;
    this.cancelRental = cancelRental;
  }

  async execute(
    now: Date = new Date()
  ): Promise<{ expired: number; cancelledRentalIds: string[]; errors: number }> {
    const batch = await this.rentalPayments.listPendingExpired(now, 50);
    let expired = 0;
    let errors = 0;
    const cancelledRentalIds: string[] = [];

    for (const p of batch) {
      try {
        let wasCancelled = false;
        await this.transactionManager.runInTransaction(async () => {
          const rental = await this.rentals.findById(p.rentalId);
          if (!rental) {
            await this.rentalPayments.setStatus(p.id, 'EXPIRED');
            return;
          }

          if (rental.status === RentalStatus.RESERVED) {
            const latestMap = await this.rentalPayments.findLatestByRentalIds([p.rentalId]);
            const latest = latestMap[p.rentalId];
            const hasPaidOrNewerActiveAttempt =
              latest !== undefined &&
              (latest.status === 'PAID' ||
                (latest.status === 'PENDING' && latest.gatewayOrderId !== p.gatewayOrderId));

            if (!hasPaidOrNewerActiveAttempt) {
              await this.cancelRental.execute({
                rentalId: p.rentalId,
                cancelledAt: now,
                note: 'Tự động hủy đơn do quá hạn thanh toán MoMo (15 phút).',
                requestingCustomerId: undefined,
              });
              wasCancelled = true;
            }
          }

          await this.rentalPayments.setStatus(p.id, 'EXPIRED');
        });
        if (wasCancelled) {
          cancelledRentalIds.push(p.rentalId);
        }
        expired += 1;
      } catch {
        errors += 1;
      }
    }

    return { expired, cancelledRentalIds, errors };
  }
}
