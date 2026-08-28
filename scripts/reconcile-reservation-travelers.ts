/*
 * Maintenance-only reconciliation for reservation travelers created before
 * operational traveler slots were materialized on reservation creation.
 *
 * Default: read-only dry-run.
 * Confirmed writes: one private, tenant-scoped RPC transaction per reservation.
 */

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerEnvironment } from "../lib/supabase/env";
import { getSupabaseProjectRef } from "./reset-demo-reservations-core";
import {
  parseReservationTravelerReconciliationArgs,
  planReservationTravelerReconciliation,
  RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION,
  type HistoricalReservationTravelerRow,
  type ReservationTravelerReconciliationPlan,
  type ReservationTravelerReconciliationReservation,
} from "./reconcile-reservation-travelers-core";

const PAGE_SIZE = 500;
const PREFLIGHT_TABLES = [
  "reservation_snapshots",
  "reservation_travelers",
] as const;

type RawReservationRow = Readonly<{
  id: string;
  agency_id: string;
  reservation_code: string;
  snapshot: unknown;
}>;

type RpcResult = Readonly<{
  result_status: string;
  created_slots: number;
  filled_slots: number;
  preserved_slots: number;
}>;

type Candidate = Readonly<{
  reservation: ReservationTravelerReconciliationReservation;
  plan: ReservationTravelerReconciliationPlan;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function safeSupabaseFailure(scope: string, error: unknown): never {
  const source =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        })
      : {};
  console.error(`Error Supabase en ${scope}:`, {
    code: typeof source.code === "string" ? source.code : null,
    message: typeof source.message === "string" ? source.message : null,
    details: typeof source.details === "string" ? source.details : null,
    hint: typeof source.hint === "string" ? source.hint : null,
  });
  fail(`No fue posible completar el preflight de ${scope}.`);
}

function createServiceRoleClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseServerEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function listAll<T>(
  scope: string,
  readPage: (
    from: number,
    to: number,
  ) => Promise<Readonly<{ data: T[] | null; error: unknown }>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await readPage(offset, offset + PAGE_SIZE - 1);
    if (error) safeSupabaseFailure(scope, error);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

async function preflightRequiredTables(
  supabase: SupabaseClient,
): Promise<void> {
  for (const table of PREFLIGHT_TABLES) {
    const { error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) safeSupabaseFailure(table, error);
  }
}

async function collectCandidates(supabase: SupabaseClient): Promise<
  Readonly<{
    candidates: Candidate[];
    noActionReservations: number;
    missingSlots: number;
    emptySlots: number;
    pendingWithoutSourceSlots: number;
    preservedSlots: number;
  }>
> {
  // Both sources are read completely before confirm mode can invoke one RPC.
  const [reservations, travelers] = await Promise.all([
    listAll<RawReservationRow>("reservation_snapshots", async (from, to) => {
      const result = await supabase
        .from("reservation_snapshots")
        .select("id,agency_id,reservation_code,snapshot")
        .order("id", { ascending: true })
        .range(from, to);
      return {
        data: result.data as RawReservationRow[] | null,
        error: result.error,
      };
    }),
    listAll<HistoricalReservationTravelerRow>(
      "reservation_travelers",
      async (from, to) => {
        const result = await supabase
          .from("reservation_travelers")
          .select(
            "id,agency_id,reservation_id,position,traveler_type,first_name,last_name,birth_date,status",
          )
          .order("reservation_id", { ascending: true })
          .order("position", { ascending: true })
          .range(from, to);
        return {
          data: result.data as HistoricalReservationTravelerRow[] | null,
          error: result.error,
        };
      },
    ),
  ]);

  const travelersByReservation = new Map<
    string,
    HistoricalReservationTravelerRow[]
  >();
  for (const traveler of travelers) {
    travelersByReservation.set(traveler.reservation_id, [
      ...(travelersByReservation.get(traveler.reservation_id) ?? []),
      traveler,
    ]);
  }

  const candidates: Candidate[] = [];
  let noActionReservations = 0;
  let missingSlots = 0;
  let emptySlots = 0;
  let pendingWithoutSourceSlots = 0;
  let preservedSlots = 0;
  for (const row of reservations) {
    if (!row.id || !row.agency_id || !row.reservation_code) {
      fail("Se encontró una reservación con estructura inválida.");
    }
    const reservation = {
      reservationId: row.id,
      agencyId: row.agency_id,
      reservationCode: row.reservation_code,
      snapshot: row.snapshot,
    };
    const plan = planReservationTravelerReconciliation({
      reservation,
      travelers: travelersByReservation.get(row.id) ?? [],
    });
    missingSlots += plan.missingSlots;
    emptySlots += plan.emptySlots;
    pendingWithoutSourceSlots += plan.pendingWithoutSourceSlots;
    preservedSlots += plan.preservedSlots;
    if (plan.status === "candidate") candidates.push({ reservation, plan });
    else noActionReservations += 1;
  }

  return {
    candidates,
    noActionReservations,
    missingSlots,
    emptySlots,
    pendingWithoutSourceSlots,
    preservedSlots,
  };
}

async function reconcileCandidate(
  supabase: SupabaseClient,
  candidate: Candidate,
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(
    "reconcile_reservation_travelers_atomic",
    {
      target_agency_id: candidate.reservation.agencyId,
      target_reservation_id: candidate.reservation.reservationId,
    },
  );
  if (error)
    safeSupabaseFailure(
      `la reconciliación de ${candidate.reservation.reservationCode}`,
      error,
    );
  const row = (
    Array.isArray(data) ? data[0] : data
  ) as Partial<RpcResult> | null;
  if (
    !row ||
    (row.result_status !== "reconciled" && row.result_status !== "no_action") ||
    !Number.isInteger(row.created_slots) ||
    !Number.isInteger(row.filled_slots) ||
    !Number.isInteger(row.preserved_slots)
  ) {
    fail(
      `La reconciliación de ${candidate.reservation.reservationCode} devolvió un estado no esperado.`,
    );
  }
  return row as RpcResult;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const mode = parseReservationTravelerReconciliationArgs(
    process.argv.slice(2),
  );
  const { url } = getSupabaseServerEnvironment();
  console.log(
    `Supabase project ref: ${getSupabaseProjectRef(url) ?? "no disponible"}`,
  );
  console.log(
    `Modo: ${mode === "dry-run" ? "dry-run (sin escrituras)" : "confirmado"}`,
  );

  const supabase = createServiceRoleClient();
  await preflightRequiredTables(supabase);
  const summary = await collectCandidates(supabase);

  console.log(`Reservaciones candidatas: ${summary.candidates.length}`);
  console.log(`Slots faltantes: ${summary.missingSlots}`);
  console.log(`Slots vacíos con datos fuente: ${summary.emptySlots}`);
  console.log(
    `Slots pendientes sin datos fuente: ${summary.pendingWithoutSourceSlots}`,
  );
  console.log(`Slots preservados: ${summary.preservedSlots}`);
  console.log(`Reservaciones sin acción: ${summary.noActionReservations}`);
  for (const candidate of summary.candidates) {
    const count = candidate.plan.missingSlots + candidate.plan.emptySlots;
    console.log(
      `${candidate.reservation.reservationCode} · ${count} traveler${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"} de materialización`,
    );
  }

  if (mode === "dry-run") {
    console.log(
      `Dry-run finalizado. Confirmación requerida: npm run maintenance:reconcile-travelers -- --confirm=${RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION}`,
    );
    return;
  }

  for (const candidate of summary.candidates) {
    const result = await reconcileCandidate(supabase, candidate);
    console.log(
      `${candidate.reservation.reservationCode} · ${result.result_status} · creados ${result.created_slots} · completados ${result.filled_slots} · preservados ${result.preserved_slots}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No fue posible reconciliar los viajeros.",
  );
  process.exitCode = 1;
});
