import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { PaymentReceiptRevocationRepositoryClient } from "./payment-receipt-revocation-core";

function databaseFailure() {
  return new Error("No fue posible actualizar el comprobante de pago.");
}

/** Service-role adapter, reached only after the revocation command authorizes the admin. */
export function createSupabasePaymentReceiptRevocationRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): PaymentReceiptRevocationRepositoryClient {
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select("id")
        .eq("id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
    async findPayment({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("status")
        .eq("id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return data ? { status: String((data as { status: unknown }).status) } : null;
    },
    async revokeAvailableReceipts({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_documents")
        .update({ status: "revoked" })
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("payment_id", paymentId)
        .eq("document_type", "payment_receipt")
        .eq("status", "available")
        .select("id");
      if (error) throw databaseFailure();
      return data?.length ?? 0;
    },
    async hasReceipt({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_documents")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("payment_id", paymentId)
        .eq("document_type", "payment_receipt")
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
  };
}
