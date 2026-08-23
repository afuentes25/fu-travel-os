import "server-only";

import { randomBytes } from "node:crypto";

import QRCode from "qrcode";
import { boardingQrPayload, hashBoardingToken } from "./ticket-boarding-credential-core";

export type TicketBoardingCredentialMaterial = Readonly<{
  tokenSha256: string;
  qrPng: Uint8Array;
}>;


/** Generates an opaque 256-bit secret only in memory; callers persist its hash. */
export async function createTicketBoardingCredentialMaterial(): Promise<TicketBoardingCredentialMaterial> {
  const rawToken = randomBytes(32).toString("base64url");
  const dataUrl = await QRCode.toDataURL(boardingQrPayload(rawToken), {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("No fue posible generar el código de abordaje.");
  return {
    tokenSha256: hashBoardingToken(rawToken),
    qrPng: new Uint8Array(Buffer.from(encoded, "base64")),
  };
}
