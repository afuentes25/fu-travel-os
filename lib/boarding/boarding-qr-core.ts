export const BOARDING_QR_PREFIX = "FUTRAVEL:BOARDING:1:";

const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Strict client-safe parser. It returns only the opaque secret carried by the QR. */
export function extractBoardingRawToken(payload: unknown): string | null {
  if (typeof payload !== "string" || !payload.startsWith(BOARDING_QR_PREFIX)) return null;
  const rawToken = payload.slice(BOARDING_QR_PREFIX.length);
  return RAW_TOKEN_PATTERN.test(rawToken) ? rawToken : null;
}

export function isBoardingRawToken(value: unknown): value is string {
  return typeof value === "string" && RAW_TOKEN_PATTERN.test(value);
}
