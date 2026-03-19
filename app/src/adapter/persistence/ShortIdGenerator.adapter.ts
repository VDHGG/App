import type { IdGenerator } from '@port/IdGenerator.port';

let counter = 0;

export class ShortIdGenerator implements IdGenerator {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  next(): string {
    counter += 1;
    return `${this.prefix}${String(counter).padStart(3, '0')}`;
  }
}
