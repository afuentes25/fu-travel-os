import { fromMinorUnits } from "@/lib/fx";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import type { Currency } from "@/types";

export const CUSTOMER_TRANSFER_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CUSTOMER_TRANSFER_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const CUSTOMER_TRANSFER_MAX_MINOR = 999_999_999_999;

export type CustomerTransferFile = Readonly<{
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type DetectedCustomerTransferFile = Readonly<{
  bytes: Uint8Array;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  extension: "pdf" | "jpg" | "png" | "webp";
}>;

export type CustomerTransferPaymentRow = Readonly<{
  id: string;
  reservationId: string;
  agencyId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  source: string;
  reference: string | null;
  paidAt: string | null;
  submittedByCustomerAccountId: string | null;
  createdAt: string;
}>;

export type CustomerTransferPaymentInsert = Readonly<{
  reservationId: string;
  agencyId: string;
  amount: number;
  currency: Currency;
  status: "pending";
  method: "transfer";
  source: "customer";
  reference: string | null;
  paidAt: string;
  submittedByCustomerAccountId: string;
  idempotencyKey: string;
}>;

export type CustomerTransferEvidenceInsert = Readonly<{
  paymentId: string;
  reservationId: string;
  agencyId: string;
  storagePath: string;
  mimeType: DetectedCustomerTransferFile["mimeType"];
  fileSizeBytes: number;
}>;

export type CustomerTransferReceipt = Readonly<{
  amount: number;
  currency: Currency;
  status: "pending";
  method: "transfer";
  paidAt: string;
}>;

export type SubmitCustomerTransferInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  amount: unknown;
  paidAt: unknown;
  reference: unknown;
  idempotencyKey: unknown;
  file: unknown;
}>;

export type SubmitCustomerTransferResult =
  | Readonly<{ status: "submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "already_submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>
  | Readonly<{ status: "invalid_file" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "idempotency_conflict" }>
  | Readonly<{ status: "storage_error" }>;

export interface CustomerTransferRepositoryClient {
  findAuthorizedReservation(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<ReservationSnapshotProjectionSource | null>;
  findByIdempotencyKey(input: Readonly<{ agencyId: string; idempotencyKey: string }>): Promise<CustomerTransferPaymentRow | null>;
  insertPayment(input: CustomerTransferPaymentInsert): Promise<CustomerTransferPaymentRow>;
  hasEvidence(input: Readonly<{ paymentId: string; reservationId: string; agencyId: string }>): Promise<boolean>;
  insertEvidence(input: CustomerTransferEvidenceInsert): Promise<void>;
}

export interface CustomerTransferStorageClient {
  upload(input: Readonly<{
    path: string;
    bytes: Uint8Array;
    mimeType: DetectedCustomerTransferFile["mimeType"];
  }>): Promise<void>;
  remove(path: string): Promise<void>;
}

export class CustomerTransferError extends Error {
  readonly name = "CustomerTransferError";

  constructor() {
    super("No fue posible registrar el reporte de transferencia.");
  }
}

function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && isCustomerReservationUuid(value);
}

function parseAmountMinor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [wholeText, decimalText = ""] = text.split(".");
  const whole = Number(wholeText);
  if (!Number.isSafeInteger(whole)) return null;
  const minor = whole * 100 + Number(decimalText.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= CUSTOMER_TRANSFER_MAX_MINOR
    ? minor
    : null;
}

function normalizeReference(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function isCalendarDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function normalizePaidAt(value: unknown, now: Date): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > now.getTime() + CUSTOMER_TRANSFER_FUTURE_TOLERANCE_MS) return null;
  return parsed.toISOString();
}

function isCustomerTransferFile(value: unknown): value is CustomerTransferFile {
  return typeof value === "object"
    && value !== null
    && "size" in value
    && typeof (value as { size?: unknown }).size === "number"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

/** Validates content signatures; browser MIME/name are deliberately ignored. */
export async function detectCustomerTransferFile(file: unknown): Promise<DetectedCustomerTransferFile | null> {
  if (!isCustomerTransferFile(file) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > CUSTOMER_TRANSFER_MAX_FILE_BYTES) return null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > CUSTOMER_TRANSFER_MAX_FILE_BYTES || bytes.length !== file.size) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { bytes, mimeType: "application/pdf", extension: "pdf" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { bytes, mimeType: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { bytes, mimeType: "image/png", extension: "png" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return { bytes, mimeType: "image/webp", extension: "webp" };
  return null;
}

function normalizeStoredPaidAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function receiptFromPayment(payment: CustomerTransferPaymentRow): CustomerTransferReceipt | null {
  const amountMinor = parseAmountMinor(payment.amount);
  const paidAt = normalizeStoredPaidAt(payment.paidAt);
  if (amountMinor === null || !isCurrency(payment.currency) || payment.status !== "pending" || payment.method !== "transfer" || !paidAt) return null;
  return { amount: fromMinorUnits(amountMinor, payment.currency), currency: payment.currency, status: "pending", method: "transfer", paidAt };
}

function samePayment(payment: CustomerTransferPaymentRow, candidate: CustomerTransferPaymentInsert) {
  return payment.reservationId === candidate.reservationId
    && payment.agencyId === candidate.agencyId
    && parseAmountMinor(payment.amount) === parseAmountMinor(candidate.amount)
    && payment.currency === candidate.currency
    && payment.status === candidate.status
    && payment.method === candidate.method
    && payment.source === candidate.source
    && payment.reference === candidate.reference
    && normalizeStoredPaidAt(payment.paidAt) === candidate.paidAt
    && payment.submittedByCustomerAccountId === candidate.submittedByCustomerAccountId;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

function denied(access: CustomerAgencyAccess): Exclude<SubmitCustomerTransferResult,
  Readonly<{ status: "submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "already_submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>
  | Readonly<{ status: "invalid_file" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "idempotency_conflict" }>
  | Readonly<{ status: "storage_error" }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function storagePath(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string; extension: string }>) {
  return `${input.agencyId}/${input.reservationId}/${input.paymentId}/evidence.${input.extension}`;
}

/** DB then private storage reconciliation; a pending payment survives a recoverable storage failure. */
export function createCustomerTransferEvidenceService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerTransferRepositoryClient | (() => CustomerTransferRepositoryClient);
  storage: CustomerTransferStorageClient | (() => CustomerTransferStorageClient);
  now?: () => Date;
}>) {
  return {
    async submit(input: SubmitCustomerTransferInput): Promise<SubmitCustomerTransferResult> {
      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined });
      } catch {
        throw new CustomerTransferError();
      }
      const accessDenied = denied(access);
      if (accessDenied) return accessDenied;
      if (access.status !== "authorized") return { status: "forbidden" };

      const fieldErrors: Record<string, string> = {};
      if (!isUuid(input.reservationId)) fieldErrors.reservationId = "La reservación no es válida.";
      const amountMinor = parseAmountMinor(input.amount);
      if (amountMinor === null) fieldErrors.amount = "Ingresa un importe válido con máximo dos decimales.";
      const reference = normalizeReference(input.reference);
      if (reference === undefined || (reference?.length ?? 0) > 120) fieldErrors.reference = "La referencia no es válida.";
      const paidAt = normalizePaidAt(input.paidAt, (dependencies.now ?? (() => new Date()))());
      if (!paidAt) fieldErrors.paidAt = "La fecha de pago no es válida.";
      if (!isUuid(input.idempotencyKey)) fieldErrors.idempotencyKey = "La solicitud no es válida.";
      if (Object.keys(fieldErrors).length) return { status: "invalid_input", fieldErrors };
      const file = await detectCustomerTransferFile(input.file);
      if (!file) return { status: "invalid_file" };

      const reservationId = input.reservationId as string;
      const idempotencyKey = input.idempotencyKey as string;
      const repository = typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
      const storage = typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
      try {
        const reservation = await repository.findAuthorizedReservation({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          reservationId,
        });
        if (!reservation) return { status: "not_found" };
        const currency = projectReservationSnapshotOperational(reservation).amounts.currency;
        if (!isCurrency(currency)) return { status: "invalid_structure" };
        const candidate: CustomerTransferPaymentInsert = {
          reservationId,
          agencyId: access.account.agencyId,
          amount: fromMinorUnits(amountMinor as number, currency),
          currency,
          status: "pending",
          method: "transfer",
          source: "customer",
          reference: reference as string | null,
          paidAt: paidAt as string,
          submittedByCustomerAccountId: access.account.customerAccountId,
          idempotencyKey,
        };
        let payment = await repository.findByIdempotencyKey({ agencyId: access.account.agencyId, idempotencyKey });
        if (payment && !samePayment(payment, candidate)) return { status: "idempotency_conflict" };
        if (!payment) {
          try {
            payment = await repository.insertPayment(candidate);
          } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            payment = await repository.findByIdempotencyKey({ agencyId: access.account.agencyId, idempotencyKey });
            if (!payment) throw error;
            if (!samePayment(payment, candidate)) return { status: "idempotency_conflict" };
          }
        }
        const receipt = receiptFromPayment(payment);
        if (!receipt) return { status: "invalid_structure" };
        if (await repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: access.account.agencyId })) {
          return { status: "already_submitted", payment: receipt };
        }
        const path = storagePath({ agencyId: access.account.agencyId, reservationId, paymentId: payment.id, extension: file.extension });
        try {
          await storage.upload({ path, bytes: file.bytes, mimeType: file.mimeType });
        } catch {
          if (await repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: access.account.agencyId })) {
            return { status: "already_submitted", payment: receipt };
          }
          return { status: "storage_error" };
        }
        try {
          await repository.insertEvidence({
            paymentId: payment.id,
            reservationId,
            agencyId: access.account.agencyId,
            storagePath: path,
            mimeType: file.mimeType,
            fileSizeBytes: file.bytes.length,
          });
        } catch (error) {
          if (isUniqueViolation(error) && await repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: access.account.agencyId })) {
            return { status: "already_submitted", payment: receipt };
          }
          try { await storage.remove(path); } catch { /* retained pending payment can be retried safely */ }
          throw error;
        }
        return { status: "submitted", payment: receipt };
      } catch (error) {
        if (error instanceof CustomerTransferError) throw error;
        throw new CustomerTransferError();
      }
    },
  };
}
