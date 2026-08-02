import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  CustomerReservationRepositoryClient,
  CustomerReservationStatus,
} from "./customer-reservations-core";

type SupabaseCustomerReservationLinkRow = Readonly<{
  reservation_id: string;
  reservation_snapshots:
    | {
        id: string;
        reservation_code: string;
        status: string;
        currency: "MXN" | "USD";
        created_at: string;
        snapshot: unknown;
      }
    | {
        id: string;
        reservation_code: string;
        status: string;
        currency: "MXN" | "USD";
        created_at: string;
        snapshot: unknown;
      }[]
    | null;
}>;

function safeCustomerReservationRepositoryError() {
  return new Error("No fue posible consultar las reservaciones.");
}

/**
 * Service-role projection is allowed only after customer access resolves.
 * The query always scopes the link by customer account and agency, then joins
 * snapshots through its composite tenant foreign key in one query.
 */
export function createSupabaseCustomerReservationRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerReservationRepositoryClient {
  return {
    async list({ customerAccountId, agencyId, status, limit, offset }) {
      let query = supabase
        .from("reservation_customer_access")
        .select(
          "reservation_id, reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id, reservation_code, status, currency, created_at, snapshot)",
          { count: "exact" },
        )
        .eq("customer_account_id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("reservation_snapshots.agency_id", agencyId);
      if (status) query = query.eq("reservation_snapshots.status", status as CustomerReservationStatus);
      const { data, error, count } = await query
        .order("created_at", { referencedTable: "reservation_snapshots", ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw safeCustomerReservationRepositoryError();

      const rows = (data ?? []).flatMap((link) => {
        const typed = link as SupabaseCustomerReservationLinkRow;
        const snapshot = Array.isArray(typed.reservation_snapshots)
          ? typed.reservation_snapshots[0]
          : typed.reservation_snapshots;
        return snapshot ? [snapshot] : [];
      });
      return { rows, total: count ?? 0 };
    },
  };
}
