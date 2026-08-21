import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { CustomerPaymentHistoryRepositoryClient } from "./customer-payment-list-core";

type LinkedReservationRow = Readonly<{
  reservation_snapshots: Readonly<{ id: string }> | Readonly<{ id: string }>[] | null;
}>;

function databaseFailure() {
  return new Error("No fue posible consultar los pagos de la reservación.");
}

/** Service-role ledger read, scoped by the verified active customer account before payment lookup. */
export function createSupabaseCustomerPaymentHistoryRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerPaymentHistoryRepositoryClient {
  return {
    async findLinkedReservation({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_customer_access")
        .select("reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id)")
        .eq("customer_account_id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("reservation_snapshots.agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      const linked = data as LinkedReservationRow | null;
      const reservation = Array.isArray(linked?.reservation_snapshots)
        ? linked.reservation_snapshots[0]
        : linked?.reservation_snapshots;
      return Boolean(reservation);
    },
    async listPayments({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("amount, currency, status, method, paid_at, created_at")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .order("paid_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw databaseFailure();
      return (data ?? []).map((payment) => ({
        amount: Number(payment.amount),
        currency: String(payment.currency),
        status: String(payment.status),
        method: String(payment.method),
        paidAt: typeof payment.paid_at === "string" ? payment.paid_at : null,
        createdAt: String(payment.created_at),
      }));
    },
  };
}
