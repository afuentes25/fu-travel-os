import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { AdminPaymentHistoryRepositoryClient, AdminPaymentHistoryRow } from "./admin-payment-list-core";

type SupabasePaymentRow = Readonly<{
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
  created_by_user_id: string | null;
  status_changed_at: string | null;
  source: string | null;
  payment_evidence: Readonly<{ mime_type: string }> | Readonly<{ mime_type: string }>[] | null;
}>;

function databaseFailure() {
  return new Error("No fue posible consultar los pagos de la reservación.");
}

/** Service-role adapter, reached only after verified administrative authorization. */
export function createSupabaseAdminPaymentHistoryRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminPaymentHistoryRepositoryClient {
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
    async listPayments({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("id, amount, currency, status, method, reference, paid_at, created_at, created_by_user_id, status_changed_at, source, payment_evidence(mime_type)")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .order("paid_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw databaseFailure();
      return (data ?? []).map((row) => {
        const payment = row as SupabasePaymentRow;
        const evidence = Array.isArray(payment.payment_evidence)
          ? payment.payment_evidence[0] ?? null
          : payment.payment_evidence;
        const mimeType = evidence?.mime_type;
        return {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          reference: payment.reference,
          paidAt: payment.paid_at,
          createdAt: payment.created_at,
          createdByUserId: payment.created_by_user_id,
          statusChangedAt: payment.status_changed_at,
          source: payment.source,
          hasEvidence: Boolean(evidence),
          evidenceMimeType: mimeType === "application/pdf" || mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp"
            ? mimeType
            : null,
        };
      });
    },
    async findDisplayNames(userIds) {
      if (!userIds.length) return new Map<string, string>();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", [...userIds]);
      if (error) throw databaseFailure();
      return new Map(
        (data ?? []).flatMap((profile) =>
          typeof profile.user_id === "string" && typeof profile.display_name === "string" && profile.display_name.trim()
            ? [[profile.user_id, profile.display_name.trim()] as const]
            : [],
        ),
      );
    },
  };
}
