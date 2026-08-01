import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createReservationSnapshotRepository,
  type PersistedReservationSnapshot,
  type ReservationSnapshotPersistenceInput,
  type ReservationSnapshotRepositoryClient,
} from "@/lib/reservations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseReservationRow = {
  agency_id: string;
  idempotency_key: string;
  reservation_code: string;
  status: PersistedReservationSnapshot["status"];
  currency: PersistedReservationSnapshot["currency"];
  snapshot: PersistedReservationSnapshot["snapshot"];
};

type SupabaseFailure = Error & { code?: string };

function databaseFailure(error: unknown): SupabaseFailure {
  const failure = new Error("Supabase reservation snapshot query failed") as SupabaseFailure;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    failure.code = (error as { code: string }).code;
  }
  return failure;
}

function fromRow(row: SupabaseReservationRow): PersistedReservationSnapshot {
  return {
    agencyId: row.agency_id,
    idempotencyKey: row.idempotency_key,
    reservationCode: row.reservation_code,
    status: row.status,
    currency: row.currency,
    snapshot: row.snapshot,
  };
}

/**
 * Adapter for server-side use only. The service role stays inside
 * getSupabaseServerClient and is never returned to callers.
 */
export function createSupabaseReservationSnapshotClient(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ReservationSnapshotRepositoryClient {
  return {
    async findByIdempotency({ agencyId, idempotencyKey }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select(
          "agency_id, idempotency_key, reservation_code, status, currency, snapshot",
        )
        .eq("agency_id", agencyId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? fromRow(data as SupabaseReservationRow) : null;
    },

    async findByReservationCode({ agencyId, reservationCode }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select(
          "agency_id, idempotency_key, reservation_code, status, currency, snapshot",
        )
        .eq("agency_id", agencyId)
        .eq("reservation_code", reservationCode)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? fromRow(data as SupabaseReservationRow) : null;
    },

    async insert(snapshot) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .insert({
          agency_id: snapshot.agencyId,
          idempotency_key: snapshot.idempotencyKey,
          reservation_code: snapshot.reservationCode,
          status: snapshot.status,
          currency: snapshot.currency,
          snapshot: snapshot.snapshot,
        })
        .select(
          "agency_id, idempotency_key, reservation_code, status, currency, snapshot",
        )
        .single();
      if (error) throw databaseFailure(error);
      return fromRow(data as SupabaseReservationRow);
    },
  };
}

export async function insertReservationSnapshot(
  input: ReservationSnapshotPersistenceInput,
) {
  return createReservationSnapshotRepository(
    createSupabaseReservationSnapshotClient(),
  ).insert(input);
}
