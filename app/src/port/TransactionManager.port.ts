export interface TransactionManager {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
