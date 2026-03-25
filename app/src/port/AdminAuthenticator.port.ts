export interface AdminAuthenticator {
  verifyAdminCredentials(email: string, password: string): Promise<boolean>;
}
