import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AdminPaymentStatusRepositoryClient,
  ManualPaymentStatus,
  StoredPaymentStatusRow,
} from "./admin-payment-status-core";

function databaseFailure() {
  return new Error("No fue posible actualizar el estado del pago.");
}

/** Service-role update adapter; all tenant and membership checks happen in the command first. */
export function createSupabaseAdminPaymentStatusRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminPaymentStatusRepositoryClient {
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
        .select("id, status, source")
        .eq("id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return data as StoredPaymentStatusRow | null;
    },
    async hasEvidence({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("payment_evidence")
        .select("id")
        .eq("payment_id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
    async updateStatus({ agencyId, reservationId, paymentId, expectedStatus, nextStatus, actorUserId, changedAt }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .update({
          status: nextStatus as ManualPaymentStatus,
          status_changed_by_user_id: actorUserId,
          status_changed_at: changedAt,
        })
        .eq("id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .eq("status", expectedStatus)
        .select("id")
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
  };
}
