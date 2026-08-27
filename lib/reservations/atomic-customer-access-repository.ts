import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ReservationSnapshotConflictError, type ReservationSnapshot } from ".";
import {
  AtomicReservationPersistenceError,
  type AtomicReservationPersistenceClient,
  type ReservationCreationFailureEvent,
  type ReservationCustomerLinkStatus,
} from "./atomic-customer-access-core";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type AtomicReservationRpcRow = Readonly<{
  result_status: string;
  reservation_row_id: string;
  reservation_code: string;
  reservation_status: string;
  reservation_currency: string;
  reservation_snapshot: unknown;
  reservation_created_at: string;
  customer_link_status: string | null;
}>;

const knownFailureEvents = new Set<ReservationCreationFailureEvent>([
  "reservation_create_failed",
  "auth_identity_failed",
  "customer_account_failed",
  "primary_access_failed",
  "reservation_already_claimed",
]);

function failureEvent(error: unknown): ReservationCreationFailureEvent {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  for (const event of knownFailureEvents) {
    if (message.includes(event)) return event;
  }
  return "reservation_create_failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLinkStatus(value: unknown): value is ReservationCustomerLinkStatus {
  return ["linked", "already_linked", "email_mismatch", "not_authenticated"].includes(
    String(value),
  );
}

function projectReservation(row: AtomicReservationRpcRow): ReservationSnapshot {
  if (
    !row.reservation_row_id ||
    !row.reservation_code ||
    !row.reservation_created_at ||
    !isRecord(row.reservation_snapshot)
  ) {
    throw new AtomicReservationPersistenceError("reservation_create_failed");
  }
  return {
    ...(row.reservation_snapshot as unknown as ReservationSnapshot),
    // The database UUID is the only identifier allowed for routes and FKs.
    // The FT-* folio remains separately available as reservationCode.
    id: row.reservation_row_id,
    reservationCode: row.reservation_code,
    createdAt: row.reservation_created_at,
  };
}

export function createAtomicReservationPersistenceClient(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AtomicReservationPersistenceClient {
  return {
    async persist(input) {
      const { data, error } = await supabase.rpc(
        "create_reservation_with_customer_access_atomic",
        {
          target_agency_id: input.agencyId,
          target_idempotency_key: input.idempotencyKey,
          target_reservation_code: input.snapshot.reservationCode,
          target_status: input.snapshot.status,
          target_currency: input.snapshot.currency,
          target_snapshot: input.snapshot,
          target_verified_auth_user_id: input.verifiedAuthUserId,
        },
      );
      if (error) throw new AtomicReservationPersistenceError(failureEvent(error));

      const raw = Array.isArray(data) ? data[0] : data;
      if (!isRecord(raw)) {
        throw new AtomicReservationPersistenceError("reservation_create_failed");
      }
      const row = raw as unknown as AtomicReservationRpcRow;
      if (row.result_status === "idempotency_conflict") {
        throw new ReservationSnapshotConflictError("idempotency");
      }
      if (row.result_status === "reservation_already_claimed") {
        throw new AtomicReservationPersistenceError("reservation_already_claimed");
      }
      if (
        !["created", "existing"].includes(row.result_status) ||
        !isLinkStatus(row.customer_link_status)
      ) {
        throw new AtomicReservationPersistenceError("reservation_create_failed");
      }

      return {
        reservation: projectReservation(row),
        created: row.result_status === "created",
        customerLinkStatus: row.customer_link_status,
      };
    },
  };
}
