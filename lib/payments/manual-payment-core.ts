import { fromMinorUnits, toMinorUnits } from "@/lib/fx";
import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import {
  isAdminReservationUuid,
} from "@/lib/reservations/admin-detail";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import type { Currency } from "@/types";
import type { PaymentReceiptLifecycleStatus } from "@/lib/documents/payment-receipt-lifecycle-core";

export const MANUAL_PAYMENT_METHODS = [
  "transfer",
  "cash",
  "card",
  "payment_link",
  "other",
] as const;

export const MANUAL_PAYMENT_INITIAL_STATUSES = ["pending", "confirmed"] as const;
export const MANUAL_PAYMENT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const MAX_MANUAL_PAYMENT_MINOR = 999_999_999_999;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
export type ManualPaymentInitialStatus = (typeof MANUAL_PAYMENT_INITIAL_STATUSES)[number];

export type CreateManualReservationPaymentInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  amount: unknown;
  method: unknown;
  initialStatus: unknown;
  reference: unknown;
  paidAt: unknown;
  idempotencyKey: unknown;
}>;

export type ManualPaymentReceipt = Readonly<{
  amount: number;
  currency: Currency;
  status: ManualPaymentInitialStatus;
  method: ManualPaymentMethod;
  reference: string | null;
  paidAt: string;
  createdAt: string;
}>;

export type ManualPaymentStoredRow = Readonly<{
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
  createdAt: string;
}>;

export type ManualPaymentInsert = Readonly<{
  reservationId: string;
  agencyId: string;
  amount: number;
  currency: Currency;
  status: ManualPaymentInitialStatus;
  method: ManualPaymentMethod;
  source: "manual";
  reference: string | null;
  paidAt: string;
  createdByUserId: string;
  idempotencyKey: string;
}>;

export interface ManualPaymentRepositoryClient {
  findReservation(input: Readonly<{
    agencyId: string;
    reservationId: string;
  }>): Promise<ReservationSnapshotProjectionSource | null>;
  findByIdempotencyKey(input: Readonly<{
    agencyId: string;
    idempotencyKey: string;
  }>): Promise<ManualPaymentStoredRow | null>;
  insert(input: ManualPaymentInsert): Promise<ManualPaymentStoredRow>;
}

export type CreateManualPaymentResult =
  | Readonly<{ status: "created"; payment: ManualPaymentReceipt; documentStatus?: PaymentReceiptLifecycleStatus }>
  | Readonly<{ status: "already_exists"; payment: ManualPaymentReceipt; documentStatus?: PaymentReceiptLifecycleStatus }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "idempotency_conflict" }>;

export class ManualPaymentError extends Error {
  readonly name = "ManualPaymentError";

  constructor() {
    super("No fue posible registrar el pago manual.");
  }
}

function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

function isMethod(value: unknown): value is ManualPaymentMethod {
  return typeof value === "string" && (MANUAL_PAYMENT_METHODS as readonly string[]).includes(value);
}

function isInitialStatus(value: unknown): value is ManualPaymentInitialStatus {
  return typeof value === "string" && (MANUAL_PAYMENT_INITIAL_STATUSES as readonly string[]).includes(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && isAdminReservationUuid(value);
}

function parseAmountMinor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [wholeText, decimalText = ""] = text.split(".");
  const whole = Number(wholeText);
  if (!Number.isSafeInteger(whole)) return null;
  const decimal = Number(decimalText.padEnd(2, "0"));
  const minor = whole * 100 + decimal;
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_MANUAL_PAYMENT_MINOR
    ? minor
    : null;
}

function normalizeReference(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : null;
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
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;
  if (parsed.getTime() > now.getTime() + MANUAL_PAYMENT_FUTURE_TOLERANCE_MS) return null;
  return parsed.toISOString();
}

function receiptFromStored(row: ManualPaymentStoredRow): ManualPaymentReceipt | null {
  if (!isCurrency(row.currency) || !isMethod(row.method) || !isInitialStatus(row.status) || !row.paidAt) {
    return null;
  }
  const amountMinor = parseAmountMinor(row.amount);
  const paidAt = normalizeStoredPaidAt(row.paidAt);
  if (amountMinor === null || !paidAt || !row.createdAt) return null;
  return {
    amount: fromMinorUnits(amountMinor, row.currency),
    currency: row.currency,
    status: row.status,
    method: row.method,
    reference: row.reference,
    paidAt,
    createdAt: row.createdAt,
  };
}

function normalizeStoredPaidAt(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function samePayment(row: ManualPaymentStoredRow, candidate: ManualPaymentInsert) {
  const storedPaidAt = row.paidAt ? normalizeStoredPaidAt(row.paidAt) : null;
  const storedAmountMinor = parseAmountMinor(row.amount);
  const candidateAmountMinor = parseAmountMinor(candidate.amount);
  return row.reservationId === candidate.reservationId
    && row.agencyId === candidate.agencyId
    && storedAmountMinor !== null
    && storedAmountMinor === candidateAmountMinor
    && row.currency === candidate.currency
    && row.status === candidate.status
    && row.method === candidate.method
    && row.source === candidate.source
    && row.reference === candidate.reference
    && storedPaidAt === candidate.paidAt;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

function accessStatus(access: AdminAgencyAccess): Exclude<CreateManualPaymentResult,
  Readonly<{ status: "created"; payment: ManualPaymentReceipt }>
  | Readonly<{ status: "already_exists"; payment: ManualPaymentReceipt }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "idempotency_conflict" }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function invalid(fieldErrors: Record<string, string>): CreateManualPaymentResult {
  return { status: "invalid_input", fieldErrors };
}

/** Server command core: all untrusted fields are validated after admin authorization. */
export function createManualReservationPaymentService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: ManualPaymentRepositoryClient | (() => ManualPaymentRepositoryClient);
  afterConfirmedPayment?: (input: Readonly<{
    requestedAgencySlug: string | undefined;
    reservationId: string;
    paymentId: string;
  }>) => Promise<PaymentReceiptLifecycleStatus>;
  now?: () => Date;
}>) {
  return {
    async create(input: CreateManualReservationPaymentInput): Promise<CreateManualPaymentResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          requestedAgencySlug: typeof input.requestedAgencySlug === "string"
            ? input.requestedAgencySlug
            : undefined,
        });
      } catch {
        throw new ManualPaymentError();
      }
      const denied = accessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };

      const fieldErrors: Record<string, string> = {};
      if (!isUuid(input.reservationId)) fieldErrors.reservationId = "La reservación no es válida.";
      const amountMinor = parseAmountMinor(input.amount);
      if (amountMinor === null) fieldErrors.amount = "Ingresa un importe válido con máximo dos decimales.";
      if (!isMethod(input.method)) fieldErrors.method = "El método de pago no es válido.";
      if (!isInitialStatus(input.initialStatus)) fieldErrors.initialStatus = "El estado inicial no es válido.";
      if (!isUuid(input.idempotencyKey)) fieldErrors.idempotencyKey = "La solicitud no es válida.";
      const reference = normalizeReference(input.reference);
      if (reference === undefined || (reference?.length ?? 0) > 120) {
        fieldErrors.reference = "La referencia no es válida.";
      }
      const paidAt = normalizePaidAt(input.paidAt, (dependencies.now ?? (() => new Date()))());
      if (!paidAt) fieldErrors.paidAt = "La fecha de pago no es válida.";
      if (Object.keys(fieldErrors).length > 0) return invalid(fieldErrors);

      const reservationId = input.reservationId as string;
      const idempotencyKey = input.idempotencyKey as string;
      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      try {
        const reservation = await repository.findReservation({
          agencyId: access.agency.agencyId,
          reservationId,
        });
        if (!reservation) return { status: "not_found" };
        const currency = projectReservationSnapshotOperational(reservation).amounts.currency;
        if (!isCurrency(currency)) return { status: "invalid_structure" };

        const candidate: ManualPaymentInsert = {
          reservationId,
          agencyId: access.agency.agencyId,
          amount: fromMinorUnits(amountMinor as number, currency),
          currency,
          status: input.initialStatus as ManualPaymentInitialStatus,
          method: input.method as ManualPaymentMethod,
          source: "manual",
          reference: reference as string | null,
          paidAt: paidAt as string,
          createdByUserId: access.identity.userId,
          idempotencyKey,
        };
        const existing = await repository.findByIdempotencyKey({
          agencyId: access.agency.agencyId,
          idempotencyKey,
        });
        const attachDocumentStatus = async (row: ManualPaymentStoredRow, receipt: ManualPaymentReceipt) => {
          if (receipt.status !== "confirmed" || !dependencies.afterConfirmedPayment) {
            return undefined;
          }
          try {
            return await dependencies.afterConfirmedPayment({
              requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined,
              reservationId,
              paymentId: row.id,
            });
          } catch {
            return "document_error" as const;
          }
        };
        if (existing) {
          const receipt = receiptFromStored(existing);
          if (!receipt || !samePayment(existing, candidate)) return { status: "idempotency_conflict" };
          const documentStatus = await attachDocumentStatus(existing, receipt);
          return documentStatus
            ? { status: "already_exists", payment: receipt, documentStatus }
            : { status: "already_exists", payment: receipt };
        }

        try {
          const created = await repository.insert(candidate);
          const receipt = receiptFromStored(created);
          if (!receipt) return { status: "invalid_structure" };
          const documentStatus = await attachDocumentStatus(created, receipt);
          return documentStatus
            ? { status: "created", payment: receipt, documentStatus }
            : { status: "created", payment: receipt };
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          const concurrent = await repository.findByIdempotencyKey({
            agencyId: access.agency.agencyId,
            idempotencyKey,
          });
          if (!concurrent) throw error;
          const receipt = receiptFromStored(concurrent);
          if (!receipt || !samePayment(concurrent, candidate)) return { status: "idempotency_conflict" };
          const documentStatus = await attachDocumentStatus(concurrent, receipt);
          return documentStatus
            ? { status: "already_exists", payment: receipt, documentStatus }
            : { status: "already_exists", payment: receipt };
        }
      } catch {
        throw new ManualPaymentError();
      }
    },
  };
}
