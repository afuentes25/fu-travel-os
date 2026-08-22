import { fromMinorUnits } from "@/lib/fx";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import { projectReservationSnapshotOperational, type ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import type { Currency } from "@/types";

export const CUSTOMER_TRANSFER_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CUSTOMER_TRANSFER_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const CUSTOMER_TRANSFER_MAX_MINOR = 999_999_999_999;

export type DetectedCustomerTransferFile = Readonly<{
  bytes: Uint8Array;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  extension: "pdf" | "jpg" | "png" | "webp";
}>;
export type CustomerTransferPaymentRow = Readonly<{
  id: string; reservationId: string; agencyId: string; amount: number; currency: string;
  status: string; method: string; source: string; reference: string | null; paidAt: string | null;
  submittedByCustomerAccountId: string | null; createdAt: string;
}>;
export type CustomerTransferPaymentInsert = Readonly<{
  reservationId: string; agencyId: string; amount: number; currency: Currency; status: "pending";
  method: "transfer"; source: "customer"; reference: string | null; paidAt: string;
  submittedByCustomerAccountId: string; idempotencyKey: string;
}>;
export type CustomerTransferEvidenceInsert = Readonly<{
  paymentId: string; reservationId: string; agencyId: string; storagePath: string;
  mimeType: DetectedCustomerTransferFile["mimeType"]; fileSizeBytes: number;
}>;
export type CustomerTransferReceipt = Readonly<{
  amount: number; currency: Currency; status: "pending"; method: "transfer"; paidAt: string;
}>;

type CustomerTransferMetadataInput = Readonly<{
  requestedAgencySlug: unknown; reservationId: unknown; amount: unknown; paidAt: unknown;
  reference: unknown; idempotencyKey: unknown;
}>;
export type PrepareCustomerTransferUploadInput = CustomerTransferMetadataInput & Readonly<{ fileSize: unknown }>;
/** This payload deliberately excludes File. Browser uploads directly to private Storage. */
export type FinalizeCustomerTransferUploadInput = CustomerTransferMetadataInput;

type TransferBaseResult =
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "idempotency_conflict" }>;
export type PrepareCustomerTransferUploadResult = TransferBaseResult
  | Readonly<{ status: "ready"; upload: Readonly<{ path: string; token: string }> }>
  | Readonly<{ status: "already_submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "storage_error" }>;
export type FinalizeCustomerTransferUploadResult = TransferBaseResult
  | Readonly<{ status: "submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "already_submitted"; payment: CustomerTransferReceipt }>
  | Readonly<{ status: "invalid_file" }>
  | Readonly<{ status: "storage_error" }>;

export interface CustomerTransferRepositoryClient {
  findAuthorizedReservation(input: Readonly<{ customerAccountId: string; agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findByIdempotencyKey(input: Readonly<{ agencyId: string; idempotencyKey: string }>): Promise<CustomerTransferPaymentRow | null>;
  insertPayment(input: CustomerTransferPaymentInsert): Promise<CustomerTransferPaymentRow>;
  hasEvidence(input: Readonly<{ paymentId: string; reservationId: string; agencyId: string }>): Promise<boolean>;
  insertEvidence(input: CustomerTransferEvidenceInsert): Promise<void>;
}
export interface CustomerTransferStorageClient {
  createSignedUpload(input: Readonly<{ path: string }>): Promise<Readonly<{ path: string; token: string }>>;
  download(path: string): Promise<Uint8Array>;
  move(input: Readonly<{ fromPath: string; toPath: string }>): Promise<void>;
  remove(path: string): Promise<void>;
}

export class CustomerTransferError extends Error {
  readonly name = "CustomerTransferError";
  constructor() { super("No fue posible registrar el reporte de transferencia."); }
}

function isCurrency(value: unknown): value is Currency { return value === "MXN" || value === "USD"; }
function isUuid(value: unknown): value is string { return typeof value === "string" && isCustomerReservationUuid(value); }
function parseAmountMinor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [wholeText, decimalText = ""] = text.split(".");
  const whole = Number(wholeText);
  if (!Number.isSafeInteger(whole)) return null;
  const minor = whole * 100 + Number(decimalText.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= CUSTOMER_TRANSFER_MAX_MINOR ? minor : null;
}
function normalizeReference(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}
function isCalendarDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}
function normalizePaidAt(value: unknown, now: Date): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? "0")];
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > now.getTime() + CUSTOMER_TRANSFER_FUTURE_TOLERANCE_MS) return null;
  return parsed.toISOString();
}
function parseFileSize(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= CUSTOMER_TRANSFER_MAX_FILE_BYTES ? parsed : null;
}
function startsWith(bytes: Uint8Array, signature: readonly number[]) { return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte); }
/** Validates the bytes downloaded server-side from private staging storage. */
export function detectCustomerTransferBytes(bytes: Uint8Array): DetectedCustomerTransferFile | null {
  if (!bytes.length || bytes.length > CUSTOMER_TRANSFER_MAX_FILE_BYTES) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { bytes, mimeType: "application/pdf", extension: "pdf" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { bytes, mimeType: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { bytes, mimeType: "image/png", extension: "png" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return { bytes, mimeType: "image/webp", extension: "webp" };
  return null;
}
function normalizeStoredPaidAt(value: string | null) { const parsed = value ? new Date(value) : null; return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null; }
function receiptFromPayment(payment: CustomerTransferPaymentRow): CustomerTransferReceipt | null {
  const amountMinor = parseAmountMinor(payment.amount); const paidAt = normalizeStoredPaidAt(payment.paidAt);
  return amountMinor === null || !isCurrency(payment.currency) || payment.status !== "pending" || payment.method !== "transfer" || !paidAt
    ? null : { amount: fromMinorUnits(amountMinor, payment.currency), currency: payment.currency, status: "pending", method: "transfer", paidAt };
}
function samePayment(payment: CustomerTransferPaymentRow, candidate: CustomerTransferPaymentInsert) {
  return payment.reservationId === candidate.reservationId && payment.agencyId === candidate.agencyId
    && parseAmountMinor(payment.amount) === parseAmountMinor(candidate.amount) && payment.currency === candidate.currency
    && payment.status === candidate.status && payment.method === candidate.method && payment.source === candidate.source
    && payment.reference === candidate.reference && normalizeStoredPaidAt(payment.paidAt) === candidate.paidAt
    && payment.submittedByCustomerAccountId === candidate.submittedByCustomerAccountId;
}
function isUniqueViolation(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505"; }
function denied(access: CustomerAgencyAccess): TransferBaseResult | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}
function stagingPath(input: Readonly<{ agencyId: string; reservationId: string; idempotencyKey: string }>) { return `${input.agencyId}/${input.reservationId}/staging/${input.idempotencyKey}`; }
function finalStoragePath(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string; extension: string }>) { return `${input.agencyId}/${input.reservationId}/${input.paymentId}/evidence.${input.extension}`; }
function metadataErrors(input: CustomerTransferMetadataInput, now: Date) {
  const fieldErrors: Record<string, string> = {};
  if (!isUuid(input.reservationId)) fieldErrors.reservationId = "La reservación no es válida.";
  const amountMinor = parseAmountMinor(input.amount); if (amountMinor === null) fieldErrors.amount = "Ingresa un importe válido con máximo dos decimales.";
  const reference = normalizeReference(input.reference); if (reference === undefined || (reference?.length ?? 0) > 120) fieldErrors.reference = "La referencia no es válida.";
  const paidAt = normalizePaidAt(input.paidAt, now); if (!paidAt) fieldErrors.paidAt = "La fecha de pago no es válida.";
  if (!isUuid(input.idempotencyKey)) fieldErrors.idempotencyKey = "La solicitud no es válida.";
  return { fieldErrors, amountMinor, reference, paidAt };
}
type ValidatedCandidate = Readonly<{ reservationId: string; stagingPath: string; candidate: CustomerTransferPaymentInsert }>;

/** Payment is intentionally created only after private staging bytes validate. */
export function createCustomerTransferUploadService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerTransferRepositoryClient | (() => CustomerTransferRepositoryClient);
  storage: CustomerTransferStorageClient | (() => CustomerTransferStorageClient);
  now?: () => Date;
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  const storage = () => typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
  async function resolveCandidate(input: CustomerTransferMetadataInput): Promise<Readonly<{ candidate: ValidatedCandidate }> | Readonly<{ result: TransferBaseResult }>> {
    let access: CustomerAgencyAccess;
    try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
    catch { throw new CustomerTransferError(); }
    const accessDenied = denied(access); if (accessDenied) return { result: accessDenied };
    if (access.status !== "authorized") return { result: { status: "forbidden" } };
    const parsed = metadataErrors(input, (dependencies.now ?? (() => new Date()))());
    if (Object.keys(parsed.fieldErrors).length) return { result: { status: "invalid_input", fieldErrors: parsed.fieldErrors } };
    const reservationId = input.reservationId as string; const idempotencyKey = input.idempotencyKey as string;
    const reservation = await repository().findAuthorizedReservation({ customerAccountId: access.account.customerAccountId, agencyId: access.account.agencyId, reservationId });
    if (!reservation) return { result: { status: "not_found" } };
    const currency = projectReservationSnapshotOperational(reservation).amounts.currency;
    if (!isCurrency(currency)) return { result: { status: "invalid_structure" } };
    return { candidate: { reservationId, stagingPath: stagingPath({ agencyId: access.account.agencyId, reservationId, idempotencyKey }), candidate: {
      reservationId, agencyId: access.account.agencyId, amount: fromMinorUnits(parsed.amountMinor as number, currency), currency,
      status: "pending", method: "transfer", source: "customer", reference: parsed.reference as string | null,
      paidAt: parsed.paidAt as string, submittedByCustomerAccountId: access.account.customerAccountId, idempotencyKey,
    } } };
  }
  async function reconcileExisting(candidate: CustomerTransferPaymentInsert, reservationId: string) {
    const payment = await repository().findByIdempotencyKey({ agencyId: candidate.agencyId, idempotencyKey: candidate.idempotencyKey });
    if (payment && !samePayment(payment, candidate)) return { kind: "conflict" } as const;
    if (payment && await repository().hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) {
      const receipt = receiptFromPayment(payment); return receipt ? { kind: "complete", receipt } as const : { kind: "invalid" } as const;
    }
    return { kind: "pending", payment } as const;
  }
  return {
    async prepare(input: PrepareCustomerTransferUploadInput): Promise<PrepareCustomerTransferUploadResult> {
      if (parseFileSize(input.fileSize) === null) return { status: "invalid_input", fieldErrors: { file: "Selecciona un comprobante de máximo 10 MB." } };
      try {
        const resolved = await resolveCandidate(input); if ("result" in resolved) return resolved.result;
        const existing = await reconcileExisting(resolved.candidate.candidate, resolved.candidate.reservationId);
        if (existing.kind === "conflict") return { status: "idempotency_conflict" };
        if (existing.kind === "invalid") return { status: "invalid_structure" };
        if (existing.kind === "complete") return { status: "already_submitted", payment: existing.receipt };
        return { status: "ready", upload: await storage().createSignedUpload({ path: resolved.candidate.stagingPath }) };
      } catch (error) { if (error instanceof CustomerTransferError) throw error; return { status: "storage_error" }; }
    },
    async finalize(input: FinalizeCustomerTransferUploadInput): Promise<FinalizeCustomerTransferUploadResult> {
      try {
        const resolved = await resolveCandidate(input); if ("result" in resolved) return resolved.result;
        const { candidate, reservationId, stagingPath: staged } = resolved.candidate;
        const existing = await reconcileExisting(candidate, reservationId);
        if (existing.kind === "conflict") return { status: "idempotency_conflict" };
        if (existing.kind === "invalid") return { status: "invalid_structure" };
        if (existing.kind === "complete") return { status: "already_submitted", payment: existing.receipt };
        let bytes: Uint8Array; try { bytes = await storage().download(staged); } catch { return { status: "storage_error" }; }
        const detected = detectCustomerTransferBytes(bytes);
        if (!detected) { try { await storage().remove(staged); } catch { /* best effort invalid-file cleanup */ } return { status: "invalid_file" }; }
        let payment = existing.payment;
        if (!payment) {
          try { payment = await repository().insertPayment(candidate); }
          catch (error) {
            if (!isUniqueViolation(error)) throw error;
            payment = await repository().findByIdempotencyKey({ agencyId: candidate.agencyId, idempotencyKey: candidate.idempotencyKey });
            if (!payment) throw error;
            if (!samePayment(payment, candidate)) return { status: "idempotency_conflict" };
          }
        }
        const receipt = receiptFromPayment(payment); if (!receipt) return { status: "invalid_structure" };
        if (await repository().hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt };
        const finalPath = finalStoragePath({ agencyId: candidate.agencyId, reservationId, paymentId: payment.id, extension: detected.extension });
        try { await storage().move({ fromPath: staged, toPath: finalPath }); }
        catch { if (await repository().hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt }; return { status: "storage_error" }; }
        try { await repository().insertEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId, storagePath: finalPath, mimeType: detected.mimeType, fileSizeBytes: detected.bytes.length }); }
        catch (error) {
          if (isUniqueViolation(error) && await repository().hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt };
          try { await storage().remove(finalPath); } catch { /* retry with same key can upload again */ }
          throw error;
        }
        return { status: "submitted", payment: receipt };
      } catch (error) { if (error instanceof CustomerTransferError) throw error; throw new CustomerTransferError(); }
    },
  };
}

// Kept as an in-memory test adapter for the byte-validation unit tests. It is
// intentionally not exported by the production command module and is never
// called by a Server Action.
export type CustomerTransferFile = Readonly<{
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;
export type SubmitCustomerTransferInput = CustomerTransferMetadataInput & Readonly<{ file: unknown }>;
export type SubmitCustomerTransferResult = FinalizeCustomerTransferUploadResult;
type LegacyStorageClient = Readonly<{
  upload: (input: Readonly<{ path: string; bytes: Uint8Array; mimeType: DetectedCustomerTransferFile["mimeType"] }>) => Promise<void>;
  remove: (path: string) => Promise<void>;
}>;

function isCustomerTransferFile(value: unknown): value is CustomerTransferFile {
  return typeof value === "object" && value !== null && "size" in value
    && typeof (value as { size?: unknown }).size === "number" && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

/** @deprecated Only used by unit tests; production finalization downloads staging Storage bytes. */
export async function detectCustomerTransferFile(file: unknown): Promise<DetectedCustomerTransferFile | null> {
  if (!isCustomerTransferFile(file) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > CUSTOMER_TRANSFER_MAX_FILE_BYTES) return null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return bytes.length === file.size ? detectCustomerTransferBytes(bytes) : null;
  } catch { return null; }
}

/** @deprecated Test-only adapter retained to exercise file-signature logic without remote Storage. */
export function createCustomerTransferEvidenceService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerTransferRepositoryClient;
  storage: LegacyStorageClient;
  now?: () => Date;
}>) {
  return {
    async submit(input: SubmitCustomerTransferInput): Promise<SubmitCustomerTransferResult> {
      let access: CustomerAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { throw new CustomerTransferError(); }
      const accessDenied = denied(access); if (accessDenied) return accessDenied;
      if (access.status !== "authorized") return { status: "forbidden" };
      const parsed = metadataErrors(input, (dependencies.now ?? (() => new Date()))());
      if (Object.keys(parsed.fieldErrors).length) return { status: "invalid_input", fieldErrors: parsed.fieldErrors };
      const detected = await detectCustomerTransferFile(input.file);
      if (!detected) return { status: "invalid_file" };
      const reservationId = input.reservationId as string; const idempotencyKey = input.idempotencyKey as string;
      try {
        const reservation = await dependencies.repository.findAuthorizedReservation({ customerAccountId: access.account.customerAccountId, agencyId: access.account.agencyId, reservationId });
        if (!reservation) return { status: "not_found" };
        const currency = projectReservationSnapshotOperational(reservation).amounts.currency;
        if (!isCurrency(currency)) return { status: "invalid_structure" };
        const candidate: CustomerTransferPaymentInsert = {
          reservationId, agencyId: access.account.agencyId, amount: fromMinorUnits(parsed.amountMinor as number, currency), currency,
          status: "pending", method: "transfer", source: "customer", reference: parsed.reference as string | null,
          paidAt: parsed.paidAt as string, submittedByCustomerAccountId: access.account.customerAccountId, idempotencyKey,
        };
        let payment = await dependencies.repository.findByIdempotencyKey({ agencyId: candidate.agencyId, idempotencyKey });
        if (payment && !samePayment(payment, candidate)) return { status: "idempotency_conflict" };
        if (!payment) {
          try { payment = await dependencies.repository.insertPayment(candidate); }
          catch (error) {
            if (!isUniqueViolation(error)) throw error;
            payment = await dependencies.repository.findByIdempotencyKey({ agencyId: candidate.agencyId, idempotencyKey });
            if (!payment) throw error;
            if (!samePayment(payment, candidate)) return { status: "idempotency_conflict" };
          }
        }
        const receipt = receiptFromPayment(payment); if (!receipt) return { status: "invalid_structure" };
        if (await dependencies.repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt };
        const path = finalStoragePath({ agencyId: candidate.agencyId, reservationId, paymentId: payment.id, extension: detected.extension });
        try { await dependencies.storage.upload({ path, bytes: detected.bytes, mimeType: detected.mimeType }); }
        catch {
          await Promise.resolve();
          if (await dependencies.repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt };
          return { status: "storage_error" };
        }
        try { await dependencies.repository.insertEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId, storagePath: path, mimeType: detected.mimeType, fileSizeBytes: detected.bytes.length }); }
        catch (error) {
          if (isUniqueViolation(error) && await dependencies.repository.hasEvidence({ paymentId: payment.id, reservationId, agencyId: candidate.agencyId })) return { status: "already_submitted", payment: receipt };
          try { await dependencies.storage.remove(path); } catch { /* test adapter cleanup */ }
          throw error;
        }
        return { status: "submitted", payment: receipt };
      } catch (error) { if (error instanceof CustomerTransferError) throw error; throw new CustomerTransferError(); }
    },
  };
}
