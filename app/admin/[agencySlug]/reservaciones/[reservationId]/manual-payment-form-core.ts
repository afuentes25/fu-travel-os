type BrowserCrypto = Pick<Crypto, "randomUUID" | "getRandomValues">;

export type ManualPaymentFormState = Readonly<{
  outcome?: "created" | "already_exists" | "idempotency_conflict";
  success?: string;
  error?: string;
  fieldErrors?: Readonly<Record<string, string>>;
  values?: Readonly<{
    amount: string;
    method: string;
    initialStatus: string;
    reference: string;
    paidAtLocal: string;
  }>;
  idempotencyKey?: string;
}>;

export const initialManualPaymentFormState: ManualPaymentFormState = {};

function calendarDateIsValid(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

/** Converts a datetime-local value into an unambiguous UTC ISO 8601 value. */
export function localDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!calendarDateIsValid(year, month, day) || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Generates a valid UUID without falling back to predictable identifiers. */
export function createManualPaymentIdempotencyKey(
  browserCrypto: BrowserCrypto | undefined = globalThis.crypto,
) {
  if (typeof browserCrypto?.randomUUID === "function") return browserCrypto.randomUUID();
  if (typeof browserCrypto?.getRandomValues !== "function") return null;
  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
