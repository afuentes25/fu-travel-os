import { createHash } from "node:crypto";

export const BOARDING_QR_PREFIX = "FUTRAVEL:BOARDING:1:";

export function hashBoardingToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function boardingQrPayload(rawToken: string): string {
  return `${BOARDING_QR_PREFIX}${rawToken}`;
}
