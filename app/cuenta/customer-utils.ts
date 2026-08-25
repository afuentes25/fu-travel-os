export type CustomerLoginCredentials = Readonly<{
  email: string;
  password: string;
}>;

/** Allows only same-origin customer routes, never administrative or external paths. */
export function safeCustomerNext(value: unknown): string | null {
  if (typeof value !== "string" || value.includes("\\") || value.includes("//")) return null;
  if (/%2f|%5c|%3a/i.test(value)) return null;
  if (!(value === "/cuenta" || value.startsWith("/cuenta/"))) return null;

  try {
    const url = new URL(value, "https://cuenta.invalid");
    if (url.origin !== "https://cuenta.invalid") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Return destinations used while a guest pauses checkout to authenticate.
 * They intentionally cover only the two public commerce routes that restore
 * their cart from the existing local cart store; they never authorize access.
 */
export function safeCustomerAuthReturnTo(value: unknown): string | null {
  const customerPath = safeCustomerNext(value);
  if (customerPath) return customerPath;
  if (typeof value !== "string" || value.includes("\\") || value.includes("//")) return null;
  if (/%2f|%5c|%3a/i.test(value)) return null;

  try {
    const url = new URL(value, "https://cuenta.invalid");
    if (url.origin !== "https://cuenta.invalid") return null;
    if (url.pathname !== "/carrito" && url.pathname !== "/checkout") return null;
    for (const [key, item] of url.searchParams) {
      if (key === "tenant" && /^[a-z0-9-]{1,80}$/i.test(item)) continue;
      if (key === "theme" && (item === "lavella" || item === "explorer")) continue;
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function validateCustomerLoginCredentials(input: Readonly<{
  email: unknown;
  password: unknown;
}>): CustomerLoginCredentials | null {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return null;
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return null;
  return { email, password };
}

export function parseCustomerReservationClaimNext(value: unknown): Readonly<{ agencySlug: string; reservationId: string }> | null {
  const next = safeCustomerNext(value);
  if (!next) return null;
  const match = /^\/cuenta\/([^/?#]+)\/reservaciones\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(next);
  return match ? { agencySlug: decodeURIComponent(match[1]), reservationId: match[2] } : null;
}
