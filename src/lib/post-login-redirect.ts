/**
 * Return `next` from the current URL if it is a safe same-origin relative path.
 * Rejects protocol-relative (`//foo`), absolute (`http://...`) and non-`/` paths.
 */
export function getSafeNextParam(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("next");
    return validateNext(raw);
  } catch {
    return null;
  }
}

export function validateNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

const KEY = "snakk:post_login_next";

export function stashNext(path: string | null) {
  const safe = validateNext(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
  } catch {
    /* ignore */
  }
}

export function consumeStashedNext(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return validateNext(v);
  } catch {
    return null;
  }
}
