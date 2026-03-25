const ADMIN_TOKEN_KEY = 'shoe_rental_admin_token';

export function getAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminAccessToken(token: string): void {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminAccessToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
