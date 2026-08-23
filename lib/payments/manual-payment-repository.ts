import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toMinorUnits } from "@/lib/fx";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

import type {
  ManualPaymentAtomicCreateResult,
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

type AtomicCreateRow = Readonly<{
  result_status: string;
  payment_id: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_paid_at: string | null;
  payment_created_at: string | null;
}>;

function atomicCreateResult(value: unknown): ManualPaymentAtomicCreateResult {
  const row = (Array.isArray(value) ? value[0] : value) as AtomicCreateRow | null;
  if (!row) throw databaseFailure(null);
  if (row.result_status === "created" || row.result_status === "existing") {
    if (!row.payment_id || row.payment_amount === null || !row.payment_currency || !row.payment_status
      || !row.payment_method || !row.payment_paid_at || !row.payment_created_at) throw databaseFailure(null);
    return {
      status: row.result_status,
      payment: {
        id: row.payment_id,
        reservationId: "",
        agencyId: "",
        amount: Number(row.payment_amount),
        currency: row.payment_currency,
        status: row.payment_status,
        method: row.payment_method,
        source: "manual",
        reference: row.payment_reference,
        paidAt: row.payment_paid_at,
        createdAt: row.payment_created_at,
      },
    };
  }
  if (row.result_status === "reservation_paid_in_full" || row.result_status === "amount_exceeds_reportable_balance"
    || row.result_status === "amount_exceeds_confirmable_balance" || row.result_status === "historical_overpayment"
    || row.result_status === "idempotency_conflict" || row.result_status === "invalid_structure" || row.result_status === "not_found") {
    return { status: row.result_status };
  }
  throw databaseFailure(null);
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

    async createAtomic({ contractTotalCents, payment }) {
      const { data, error } = await supabase.rpc("create_manual_reservation_payment_atomic", {
        target_agency_id: payment.agencyId,
        target_reservation_id: payment.reservationId,
        target_contract_total_cents: contractTotalCents,
        target_amount_cents: toMinorUnits(payment.amount, payment.currency),
        target_currency: payment.currency,
        target_status: payment.status,
        target_method: payment.method,
        target_reference: payment.reference,
        target_paid_at: payment.paidAt,
        target_created_by_user_id: payment.createdByUserId,
        target_idempotency_key: payment.idempotencyKey,
      });
      if (error) throw databaseFailure(error);
      const result = atomicCreateResult(data);
      if (result.status === "created" || result.status === "existing") {
        return { ...result, payment: { ...result.payment, reservationId: payment.reservationId, agencyId: payment.agencyId } };
      }
      return result;
    },
  };
}
