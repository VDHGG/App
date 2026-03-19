import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@port/IdGenerator.port';

export class UuidGenerator implements IdGenerator {
  private readonly prefix: string;

  constructor(prefix: string) {
    if (!prefix || prefix.length !== 1) {
      throw new Error('UuidGenerator prefix must be exactly 1 character.');
    }
    this.prefix = prefix;
  }

  next(): string {
    return this.prefix + randomUUID().replace(/-/g, '').slice(0, 9);
  }
}
