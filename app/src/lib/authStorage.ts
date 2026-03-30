const ACCESS_TOKEN_KEY = 'shoe_rental_access_token';
const LEGACY_ADMIN_TOKEN_KEY = 'shoe_rental_admin_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
    window.localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY)
  );
}

export function setAccessToken(token: string): void {
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
}

/** @deprecated use getAccessToken */
export const getAdminAccessToken = getAccessToken;
/** @deprecated use setAccessToken */
export const setAdminAccessToken = setAccessToken;
/** @deprecated use clearAccessToken */
export const clearAdminAccessToken = clearAccessToken;
