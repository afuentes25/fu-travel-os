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
  const match = /^\/cuenta\/([^/?#]+)\/reservaciones\/([0-9a-f]{8}-[0-9a-f-]{27,})$/.exec(next);
  return match ? { agencySlug: decodeURIComponent(match[1]), reservationId: match[2] } : null;
}
