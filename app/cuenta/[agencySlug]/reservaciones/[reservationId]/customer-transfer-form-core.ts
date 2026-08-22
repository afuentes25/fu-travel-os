export type CustomerTransferFormState = Readonly<{
  outcome?: "submitted" | "already_submitted" | "idempotency_conflict" | "storage_error";
  success?: string;
  error?: string;
  fieldErrors?: Readonly<Record<string, string>>;
  values?: Readonly<{
    amount: string;
    paidAtLocal: string;
    reference: string;
  }>;
  idempotencyKey?: string;
}>;

export const initialCustomerTransferFormState: CustomerTransferFormState = {};

type BrowserCrypto = Pick<Crypto, "randomUUID" | "getRandomValues">;

export function createCustomerTransferIdempotencyKey(browserCrypto: BrowserCrypto = crypto) {
  if (typeof browserCrypto.randomUUID === "function") return browserCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  browserCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(`${value}:00`);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute;
}

/** Converts datetime-local into an explicit UTC timestamp before it crosses the action boundary. */
export function localTransferDateTimeToIso(value: string) {
  if (!isLocalDateTime(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function localTransferDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
