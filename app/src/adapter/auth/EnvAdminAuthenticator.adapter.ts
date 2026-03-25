import bcrypt from 'bcryptjs';
import type { AdminAuthenticator } from '@port/AdminAuthenticator.port';

function normalizePossibleQuotedHash(raw: string): string {
  const s = raw.replace(/\r/g, '').trim();
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

export class EnvAdminAuthenticator implements AdminAuthenticator {
  private readonly email: string;
  private readonly passwordHash: string;

  constructor(options: { email: string; passwordHash: string }) {
    this.email = options.email.replace(/\r/g, '').trim();
    this.passwordHash = normalizePossibleQuotedHash(options.passwordHash);
  }

  async verifyAdminCredentials(email: string, password: string): Promise<boolean> {
    const configuredEmail = this.email.trim();
    const configuredHash = this.passwordHash.trim();

    if (!configuredEmail || !configuredHash) {
      return false;
    }

    const normalized = email.trim().toLowerCase();
    if (normalized !== configuredEmail.toLowerCase()) {
      return false;
    }

    return bcrypt.compareSync(password, configuredHash);
  }
}
