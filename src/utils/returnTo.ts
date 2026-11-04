// Where to send someone after they sign in or finish registering, e.g. back to the call they
// clicked "I'm interested" on. Survives the Google OAuth round-trip (same tab, sessionStorage).
const KEY = 'bgph:return_to';

/** Only same-site paths: never a full URL, never "//evil.example". */
const isSafePath = (p: unknown): p is string => typeof p === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(p) && p.length < 300;

export const setReturnTo = (path: string) => {
  if (!isSafePath(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage unavailable */ }
};

/** Reads and clears it. */
export const takeReturnTo = (): string | null => {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isSafePath(v) ? v : null;
  } catch {
    return null;
  }
};

export const peekReturnTo = (): string | null => {
  try {
    const v = sessionStorage.getItem(KEY);
    return isSafePath(v) ? v : null;
  } catch {
    return null;
  }
};
