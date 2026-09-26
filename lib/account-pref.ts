/**
 * The account you are looking at, remembered across screens and launches.
 *
 * A cookie rather than localStorage, because Stats and the Calendar are
 * rendered on the server and have to open on the right account without a
 * flash of the wrong one. A ?account= in the URL still wins — a link to a
 * specific account means that account.
 */
export const ACCOUNT_COOKIE = 'signature_account';
export const ACCOUNT_EVENT = 'signature:account';

export function readAccountCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${ACCOUNT_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(ACCOUNT_COOKIE.length + 1)) : null;
}

export function writeAccountCookie(account: string): void {
  document.cookie = `${ACCOUNT_COOKIE}=${encodeURIComponent(account)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: account }));
}
