import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  PaymentReceiptDocumentInsert,
  PaymentReceiptDocumentRow,
  PaymentReceiptPaymentRow,
  PaymentReceiptRepositoryClient,
} from "./payment-receipt-core";

function databaseFailure(error: unknown) {
  const failure = new Error("No fue posible generar el comprobante.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") failure.code = code;
  }
  return failure;
}

function documentRow(row: Record<string, unknown>): PaymentReceiptDocumentRow {
  return {
    status: String(row.status),
    version: Number(row.version),
    generatedAt: String(row.generated_at),
  };
}

/** Service-role adapter used only after admin access is verified in the command. */
export function createSupabasePaymentReceiptRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): PaymentReceiptRepositoryClient {
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? (data as ReservationSnapshotProjectionSource) : null;
    },

    async findPayment({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("id, status, source, amount, currency, method, reference, paid_at")
        .eq("id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data
        ? {
            id: String((data as Record<string, unknown>).id),
            status: String((data as Record<string, unknown>).status),
            source: String((data as Record<string, unknown>).source),
            amount: Number((data as Record<string, unknown>).amount),
            currency: String((data as Record<string, unknown>).currency),
            method: String((data as Record<string, unknown>).method),
            reference: typeof (data as Record<string, unknown>).reference === "string"
              ? (data as Record<string, unknown>).reference as string
              : null,
            paidAt: typeof (data as Record<string, unknown>).paid_at === "string"
              ? (data as Record<string, unknown>).paid_at as string
              : null,
          }
        : null;
    },

    async listPayments({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("amount, currency, status")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId);
      if (error) throw databaseFailure(error);
      return (data ?? []).map((row) => ({
        amount: Number((row as Record<string, unknown>).amount),
        currency: String((row as Record<string, unknown>).currency),
        status: String((row as Record<string, unknown>).status),
      }));
    },

    async findExistingDocument({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_documents")
        .select("status, version, generated_at")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .eq("payment_id", paymentId)
        .eq("document_type", "payment_receipt")
        .eq("version", 1)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? documentRow(data as Record<string, unknown>) : null;
    },

    async insertDocument(document) {
      const { data, error } = await supabase
        .from("reservation_documents")
        .insert({
          reservation_id: document.reservationId,
          agency_id: document.agencyId,
          document_type: document.documentType,
          status: document.status,
          storage_path: document.storagePath,
          mime_type: document.mimeType,
          file_size_bytes: document.fileSizeBytes,
          version: document.version,
          payment_id: document.paymentId,
          generated_at: document.generatedAt,
          created_by_user_id: document.createdByUserId,
        })
        .select("status, version, generated_at")
        .single();
      if (error) throw databaseFailure(error);
      return documentRow(data as Record<string, unknown>);
    },
  };
}
