// Where to send someone after they sign in: a page of this site, never another address. The
// "callbackUrl" in a login link can be written by anyone, so a link like
// /login?callbackUrl=https://elsewhere.example must not take the person there once signed in.
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    // Parsed the way a browser would (it drops tabs and line breaks, reads "\" as "/"), so a
    // sneaky "//host" or "/\host" shows up as a different origin.
    const base = "https://site.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
