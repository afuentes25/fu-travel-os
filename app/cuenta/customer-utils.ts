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
