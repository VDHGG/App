import type { TransactionManager } from '@port/TransactionManager.port';

export class NoopTransactionManager implements TransactionManager {
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
// Noop = No Operation = Không làm gì cả = tức class này implement interface TransactionManager nhưng không làm gì cả
// nó chỉ đơn giản chạy function work() mà thôi, nó không thực hiện transaction gì cả
