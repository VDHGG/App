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

  async execute(now: Date = new Date()): Promise<{ expired: number; errors: number }> {
    const batch = await this.rentalPayments.listPendingExpired(now, 50);
    let expired = 0;
    let errors = 0;

    for (const p of batch) {
      try {
        await this.transactionManager.runInTransaction(async () => {
          const rental = await this.rentals.findById(p.rentalId);
          if (!rental) {
            await this.rentalPayments.setStatus(p.id, 'EXPIRED');
            return;
          }

          if (rental.status === RentalStatus.RESERVED) {
            await this.cancelRental.execute({
              rentalId: p.rentalId,
              cancelledAt: now,
              note: 'Online payment not completed within the allowed time.',
              requestingCustomerId: undefined,
            });
          }

          await this.rentalPayments.setStatus(p.id, 'EXPIRED');
        });
        expired += 1;
      } catch {
        errors += 1;
      }
    }

    return { expired, errors };
  }
}
