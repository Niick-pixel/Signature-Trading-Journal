/**
 * The account you are looking at, remembered across screens and launches.
 *
 * A cookie rather than localStorage, because Stats and the Calendar are
 * rendered on the server and have to open on the right account without a
 * flash of the wrong one. A ?account= in the URL still wins — a link to a
 * specific account means that account.
 */
/*
  Versioned. The first version was also written when a page merely OPENED on
  an account (Stats defaults to the busiest one), so the board narrowed itself
  to that account after a single visit and trades looked deleted. That value
  was never a choice; renaming the cookie drops it, and only a deliberate pick
  is stored from now on.
*/
export const ACCOUNT_COOKIE = 'signature_account_v2';
const RETIRED_COOKIE = 'signature_account';
export const ACCOUNT_EVENT = 'signature:account';
/** A page announcing which account it is showing — for display, never stored. */
export const ACCOUNT_SHOWN_EVENT = 'signature:account-shown';

export function readAccountCookie(): string | null {
  if (typeof document === 'undefined') return null;
  if (document.cookie.includes(`${RETIRED_COOKIE}=`)) {
    document.cookie = `${RETIRED_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${ACCOUNT_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(ACCOUNT_COOKIE.length + 1)) : null;
}

let shownAccount: { path: string; account: string } | null = null;

/** The account the current page announced, if it announced one. */
export function lastShownAccount(): string | null {
  return shownAccount && shownAccount.path === window.location.pathname ? shownAccount.account : null;
}

/** Says which account a page is showing, without remembering it as a choice. */
export function announceAccount(account: string): void {
  // Kept as well as sent: the title bar may start listening after this fires.
  shownAccount = { path: window.location.pathname, account };
  window.dispatchEvent(new CustomEvent(ACCOUNT_SHOWN_EVENT, { detail: account }));
}

/** Only for a deliberate choice — a click, never a page opening. */
export function writeAccountCookie(account: string): void {
  document.cookie = `${ACCOUNT_COOKIE}=${encodeURIComponent(account)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: account }));
}
