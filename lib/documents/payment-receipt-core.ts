import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import {
  calculateReservationFinancialSummary,
  type ReservationPaymentFinancialRow,
} from "@/lib/payments/reservation-financial-core";
import type { Currency } from "@/types";

import type { PaymentReceiptPdfData } from "./payment-receipt-pdf";

export type EnsurePaymentReceiptInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  paymentId: unknown;
}>;

export type PaymentReceiptDocument = Readonly<{
  documentType: "payment_receipt";
  version: number;
  generatedAt: string;
}>;

export type EnsurePaymentReceiptResult =
  | Readonly<{ status: "generated" | "existing"; document: PaymentReceiptDocument }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "payment_not_confirmed" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "document_storage_error" }>;

export type PaymentReceiptPaymentRow = Readonly<{
  id: string;
  status: string;
  source: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: string | null;
}>;

export type PaymentReceiptDocumentRow = Readonly<{
  status: string;
  version: number;
  generatedAt: string;
}>;

export type PaymentReceiptDocumentInsert = Readonly<{
  reservationId: string;
  agencyId: string;
  documentType: "payment_receipt";
  status: "available";
  storagePath: string;
  mimeType: "application/pdf";
  fileSizeBytes: number;
  version: 1;
  paymentId: string;
  generatedAt: string;
  createdByUserId: string;
}>;

export interface PaymentReceiptRepositoryClient {
  findReservation(input: Readonly<{
    agencyId: string;
    reservationId: string;
  }>): Promise<ReservationSnapshotProjectionSource | null>;
  findPayment(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
  }>): Promise<PaymentReceiptPaymentRow | null>;
  listPayments(input: Readonly<{
    agencyId: string;
    reservationId: string;
  }>): Promise<readonly ReservationPaymentFinancialRow[]>;
  findExistingDocument(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
  }>): Promise<PaymentReceiptDocumentRow | null>;
  insertDocument(input: PaymentReceiptDocumentInsert): Promise<PaymentReceiptDocumentRow>;
}

export interface PaymentReceiptStorageClient {
  upload(input: Readonly<{
    path: string;
    bytes: Uint8Array;
    mimeType: "application/pdf";
  }>): Promise<void>;
  remove(path: string): Promise<void>;
}

export type PaymentReceiptPdfRenderer = (data: PaymentReceiptPdfData) => Promise<Uint8Array>;

export class PaymentReceiptError extends Error {
  readonly name = "PaymentReceiptError";

  constructor() {
    super("No fue posible generar el comprobante de pago.");
  }
}

const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  payment_link: "Enlace de pago",
  other: "Otro",
};

function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

function safeDocument(row: PaymentReceiptDocumentRow): PaymentReceiptDocument | null {
  return row.status === "available" && row.version === 1 && Boolean(row.generatedAt)
    ? { documentType: "payment_receipt", version: 1, generatedAt: row.generatedAt }
    : null;
}

function accessStatus(access: AdminAgencyAccess): Exclude<
  EnsurePaymentReceiptResult,
  Readonly<{ status: "generated" | "existing"; document: PaymentReceiptDocument }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "payment_not_confirmed" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "document_storage_error" }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

function isPdf(bytes: Uint8Array) {
  return bytes.length > 4
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46;
}

async function bestEffortRemove(storage: PaymentReceiptStorageClient, path: string) {
  try {
    await storage.remove(path);
  } catch {
    // A later retry remains safe because every generated document has a unique path.
  }
}

/**
 * Admin-only receipt generation. The immutable reservation snapshot and payment
 * ledger are read before a PDF is rendered; neither is ever mutated here.
 */
export function createPaymentReceiptService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: PaymentReceiptRepositoryClient | (() => PaymentReceiptRepositoryClient);
  storage: PaymentReceiptStorageClient | (() => PaymentReceiptStorageClient);
  renderPdf: PaymentReceiptPdfRenderer;
  now?: () => Date;
  createDocumentId?: () => string;
}>) {
  return {
    async ensure(input: EnsurePaymentReceiptInput): Promise<EnsurePaymentReceiptResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          requestedAgencySlug: typeof input.requestedAgencySlug === "string"
            ? input.requestedAgencySlug
            : undefined,
        });
      } catch {
        throw new PaymentReceiptError();
      }
      const denied = accessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId)
        || typeof input.paymentId !== "string" || !isAdminReservationUuid(input.paymentId)) {
        return { status: "not_found" };
      }

      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      const storage = typeof dependencies.storage === "function"
        ? dependencies.storage()
        : dependencies.storage;
      const agencyId = access.agency.agencyId;
      const reservationId = input.reservationId;
      const paymentId = input.paymentId;

      try {
        const reservation = await repository.findReservation({ agencyId, reservationId });
        if (!reservation) return { status: "not_found" };
        const payment = await repository.findPayment({ agencyId, reservationId, paymentId });
        if (!payment) return { status: "not_found" };
        if (payment.status !== "confirmed") return { status: "payment_not_confirmed" };

        const existing = await repository.findExistingDocument({ agencyId, reservationId, paymentId });
        if (existing) {
          const document = safeDocument(existing);
          return document ? { status: "existing", document } : { status: "invalid_structure" };
        }

        const projected = projectReservationSnapshotOperational(reservation);
        const financial = calculateReservationFinancialSummary({
          snapshot: reservation,
          payments: await repository.listPayments({ agencyId, reservationId }),
        });
        const methodLabel = PAYMENT_METHOD_LABELS[payment.method];
        if (!financial || !isCurrency(payment.currency) || payment.currency !== financial.currency
          || !methodLabel || !Number.isFinite(payment.amount) || payment.amount <= 0) {
          return { status: "invalid_structure" };
        }

        const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
        const documentId = (dependencies.createDocumentId ?? crypto.randomUUID)();
        if (!isAdminReservationUuid(documentId)) return { status: "invalid_structure" };
        const path = `${agencyId}/${reservationId}/payment_receipt/${documentId}/v1.pdf`;
        const pdf = await dependencies.renderPdf({
          agencyName: access.agency.agencyName,
          documentLabel: `${projected.reservationCode} · RECIBO 1`,
          reservationCode: projected.reservationCode,
          tripName: projected.trip.name,
          departureDate: projected.trip.departureDate,
          paidAt: payment.paidAt,
          amount: payment.amount,
          currency: financial.currency,
          methodLabel,
          reference: payment.reference?.trim() || null,
          contractTotal: financial.contract.total,
          confirmedTotal: financial.payments.confirmedTotal,
          remaining: financial.balance.remaining,
        });
        if (!isPdf(pdf)) return { status: "invalid_structure" };

        try {
          await storage.upload({ path, bytes: pdf, mimeType: "application/pdf" });
        } catch {
          return { status: "document_storage_error" };
        }

        try {
          const row = await repository.insertDocument({
            reservationId,
            agencyId,
            documentType: "payment_receipt",
            status: "available",
            storagePath: path,
            mimeType: "application/pdf",
            fileSizeBytes: pdf.length,
            version: 1,
            paymentId,
            generatedAt,
            createdByUserId: access.identity.userId,
          });
          const document = safeDocument(row);
          if (!document) {
            await bestEffortRemove(storage, path);
            return { status: "invalid_structure" };
          }
          return { status: "generated", document };
        } catch (error) {
          await bestEffortRemove(storage, path);
          if (isUniqueViolation(error)) {
            const concurrent = await repository.findExistingDocument({ agencyId, reservationId, paymentId });
            const document = concurrent ? safeDocument(concurrent) : null;
            if (document) return { status: "existing", document };
          }
          throw new PaymentReceiptError();
        }
      } catch (error) {
        if (error instanceof PaymentReceiptError) throw error;
        throw new PaymentReceiptError();
      }
    },
  };
}
