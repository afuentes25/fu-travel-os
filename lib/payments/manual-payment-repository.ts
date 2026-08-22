import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

import type {
  ManualPaymentInsert,
  ManualPaymentRepositoryClient,
  ManualPaymentStoredRow,
} from "./manual-payment-core";

type SupabasePaymentRow = Readonly<{
  id: string;
  reservation_id: string;
  agency_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  source: string;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
}>;

function paymentFromRow(row: SupabasePaymentRow): ManualPaymentStoredRow {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    agencyId: row.agency_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    method: row.method,
    source: row.source,
    reference: row.reference,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function databaseFailure(error: unknown) {
  const failure = new Error("No fue posible registrar el pago.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") failure.code = code;
  }
  return failure;
}

/** Service-role adapter; the command has already verified admin membership. */
export function createSupabaseManualPaymentRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ManualPaymentRepositoryClient {
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

    async findByIdempotencyKey({ agencyId, idempotencyKey }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("id, reservation_id, agency_id, amount, currency, status, method, source, reference, paid_at, created_at")
        .eq("agency_id", agencyId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? paymentFromRow(data as SupabasePaymentRow) : null;
    },

    async insert(payment: ManualPaymentInsert) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .insert({
          reservation_id: payment.reservationId,
          agency_id: payment.agencyId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          source: payment.source,
          reference: payment.reference,
          paid_at: payment.paidAt,
          created_by_user_id: payment.createdByUserId,
          status_changed_by_user_id: null,
          status_changed_at: null,
          idempotency_key: payment.idempotencyKey,
        })
        .select("id, reservation_id, agency_id, amount, currency, status, method, source, reference, paid_at, created_at")
        .single();
      if (error) throw databaseFailure(error);
      return paymentFromRow(data as SupabasePaymentRow);
    },
  };
}
