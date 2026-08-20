import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  CustomerReservationDetailRepositoryClient,
  CustomerReservationDetailRow,
} from "./customer-reservation-detail-core";

type LinkedReservationRow = Readonly<{
  reservation_snapshots: CustomerReservationDetailRow | CustomerReservationDetailRow[] | null;
}>;

/**
 * Service-role snapshot projection remains server-only. The linked account,
 * tenant and UUID are constrained in the same query after access resolution.
 */
export function createSupabaseCustomerReservationDetailRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerReservationDetailRepositoryClient {
  return {
    async find({ customerAccountId, agencyId, reservationId }) {
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

      const linked = data as LinkedReservationRow | null;
      const snapshot = Array.isArray(linked?.reservation_snapshots)
        ? linked.reservation_snapshots[0]
        : linked?.reservation_snapshots;
      return snapshot ?? null;
    },
  };
}
