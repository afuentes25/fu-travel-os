import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

import type {
  ReservationFinancialRepositoryClient,
  ReservationPaymentFinancialRow,
} from "./reservation-financial-core";

type LinkedSnapshotRow = Readonly<{
  reservation_snapshots: ReservationSnapshotProjectionSource | ReservationSnapshotProjectionSource[] | null;
}>;

/** Service-role reads are scoped by linked customer account and agency first. */
export function createSupabaseReservationFinancialRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ReservationFinancialRepositoryClient {
  return {
    async findAuthorized({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_customer_access")
        .select(
          "reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id, reservation_code, status, currency, created_at, snapshot)",
        )
        .eq("customer_account_id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("reservation_snapshots.agency_id", agencyId)
        .maybeSingle();
      if (error) throw new Error("No fue posible consultar la reservación.");

      const linked = data as LinkedSnapshotRow | null;
      const snapshot = Array.isArray(linked?.reservation_snapshots)
        ? linked.reservation_snapshots[0]
        : linked?.reservation_snapshots;
      if (!snapshot) return null;

      const payments = await supabase
        .from("reservation_payments")
        .select("amount, currency, status")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId);
      if (payments.error) throw new Error("No fue posible consultar los pagos.");
      return {
        snapshot,
        payments: (payments.data ?? []) as ReservationPaymentFinancialRow[],
      };
    },
  };
}
