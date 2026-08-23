import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

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
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return data ? data as ReservationSnapshotProjectionSource : null;
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
    async confirmAtomic({ agencyId, reservationId, paymentId, contractTotalCents, actorUserId, changedAt }) {
      const { data, error } = await supabase.rpc("confirm_reservation_payment_atomic", {
        target_agency_id: agencyId,
        target_reservation_id: reservationId,
        target_payment_id: paymentId,
        target_contract_total_cents: contractTotalCents,
        target_actor_user_id: actorUserId,
        target_changed_at: changedAt,
      });
      if (error) throw databaseFailure();
      const status = (Array.isArray(data) ? data[0]?.result_status : (data as { result_status?: unknown } | null)?.result_status);
      if (status === "updated" || status === "not_found" || status === "evidence_required"
        || status === "payment_exceeds_remaining_balance" || status === "invalid_structure" || status === "conflict") return status;
      throw databaseFailure();
    },
  };
}
