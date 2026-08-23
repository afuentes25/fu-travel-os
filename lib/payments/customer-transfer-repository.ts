import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toMinorUnits } from "@/lib/fx";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  CustomerTransferAtomicFinalizeInput,
  CustomerTransferAtomicFinalizeResult,
  CustomerTransferEvidenceInsert,
  CustomerTransferPaymentInsert,
  CustomerTransferPaymentRow,
  CustomerTransferRepositoryClient,
} from "./customer-transfer-core";
import type { ReservationPaymentFinancialRow } from "./reservation-financial-core";

type LinkedReservationRow = Readonly<{
  reservation_snapshots: ReservationSnapshotProjectionSource | ReservationSnapshotProjectionSource[] | null;
}>;

type SupabaseCustomerTransferPaymentRow = Readonly<{
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
  submitted_by_customer_account_id: string | null;
  created_at: string;
}>;

function databaseFailure(error: unknown) {
  const failure = new Error("No fue posible registrar el reporte de transferencia.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") failure.code = code;
  }
  return failure;
}

function paymentFromRow(row: SupabaseCustomerTransferPaymentRow): CustomerTransferPaymentRow {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    agencyId: row.agency_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    method: row.method,
    source: row.source,
    reference: row.reference,
    paidAt: row.paid_at,
    submittedByCustomerAccountId: row.submitted_by_customer_account_id,
    createdAt: row.created_at,
  };
}

const PAYMENT_FIELDS = "id, reservation_id, agency_id, amount, currency, status, method, source, reference, paid_at, submitted_by_customer_account_id, created_at";

function atomicResult(value: unknown): CustomerTransferAtomicFinalizeResult {
  const status = Array.isArray(value)
    ? value[0]?.result_status
    : (value as { result_status?: unknown } | null)?.result_status;
  if (
    status === "created" || status === "existing" || status === "reservation_paid_in_full"
    || status === "pending_covers_balance" || status === "amount_exceeds_reportable_balance"
    || status === "idempotency_conflict" || status === "invalid_structure"
    || status === "not_found" || status === "forbidden"
  ) return { status };
  throw databaseFailure(null);
}

/** Service-role adapter, called only after verified customer-account authorization. */
export function createSupabaseCustomerTransferRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerTransferRepositoryClient {
  return {
    async findAuthorizedReservation({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_customer_access")
        .select("reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id, reservation_code, status, currency, created_at, snapshot)")
        .eq("customer_account_id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("reservation_snapshots.agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      const linked = data as LinkedReservationRow | null;
      const snapshot = Array.isArray(linked?.reservation_snapshots)
        ? linked.reservation_snapshots[0]
        : linked?.reservation_snapshots;
      return snapshot ?? null;
    },
    async findByIdempotencyKey({ agencyId, idempotencyKey }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select(PAYMENT_FIELDS)
        .eq("agency_id", agencyId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? paymentFromRow(data as SupabaseCustomerTransferPaymentRow) : null;
    },
    async listReservationPayments({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("amount, currency, status")
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId);
      if (error) throw databaseFailure(error);
      return (data ?? []) as ReservationPaymentFinancialRow[];
    },
    async finalizePaymentAndEvidence(input: CustomerTransferAtomicFinalizeInput) {
      const { payment, evidence } = input;
      const { data, error } = await supabase.rpc("finalize_customer_transfer_payment_atomic", {
        target_agency_id: payment.agencyId,
        target_reservation_id: payment.reservationId,
        target_customer_account_id: payment.submittedByCustomerAccountId,
        target_payment_id: input.paymentId,
        target_contract_total_cents: input.contractTotalCents,
        target_amount_cents: toMinorUnits(payment.amount, payment.currency),
        target_currency: payment.currency,
        target_reference: payment.reference,
        target_paid_at: payment.paidAt,
        target_idempotency_key: payment.idempotencyKey,
        target_storage_path: evidence.storagePath,
        target_mime_type: evidence.mimeType,
        target_file_size_bytes: evidence.fileSizeBytes,
      });
      if (error) throw databaseFailure(error);
      return atomicResult(data);
    },
    async insertPayment(payment: CustomerTransferPaymentInsert) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .insert({
          reservation_id: payment.reservationId,
          agency_id: payment.agencyId,
          amount: payment.amount,
          currency: payment.currency,
          status: "pending",
          method: "transfer",
          source: "customer",
          reference: payment.reference,
          paid_at: payment.paidAt,
          created_by_user_id: null,
          status_changed_by_user_id: null,
          status_changed_at: null,
          submitted_by_customer_account_id: payment.submittedByCustomerAccountId,
          idempotency_key: payment.idempotencyKey,
        })
        .select(PAYMENT_FIELDS)
        .single();
      if (error) throw databaseFailure(error);
      return paymentFromRow(data as SupabaseCustomerTransferPaymentRow);
    },
    async hasEvidence({ paymentId, reservationId, agencyId }) {
      const { data, error } = await supabase
        .from("payment_evidence")
        .select("id")
        .eq("payment_id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return Boolean(data);
    },
    async insertEvidence(evidence: CustomerTransferEvidenceInsert) {
      const { error } = await supabase
        .from("payment_evidence")
        .insert({
          payment_id: evidence.paymentId,
          reservation_id: evidence.reservationId,
          agency_id: evidence.agencyId,
          storage_path: evidence.storagePath,
          mime_type: evidence.mimeType,
          file_size_bytes: evidence.fileSizeBytes,
          uploaded_by_user_id: null,
        });
      if (error) throw databaseFailure(error);
    },
  };
}
