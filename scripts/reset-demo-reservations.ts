/*
 * Controlled, server-only audit/reset utility for reservation-scoped demo data.
 *
 * Default: read-only dry-run
 * Destructive confirmation: --confirm=DELETE-DEMO-RESERVATIONS
 *
 * Database deletion is delegated to a private, reservation-scoped RPC. Storage
 * deletion happens only after that transaction succeeds, using paths collected
 * and validated before the first database write.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

import { getSupabaseServerEnvironment } from "../lib/supabase/env";
import {
  DEMO_RESERVATIONS_RESET_CONFIRMATION,
  getSupabaseProjectRef,
  isStoragePathOwnedByReservation,
  parseDemoReservationResetArgs,
  RESERVATION_RESET_DELETE_ORDER,
  RESERVATION_SCOPED_TABLES,
  storagePrefixForReservation,
  type ReservationResetTarget,
  type ReservationScopedTable,
} from "./reset-demo-reservations-core";

const PAYMENT_EVIDENCE_BUCKET = "payment-evidence";
const RESERVATION_DOCUMENTS_BUCKET = "reservation-documents";
const STORAGE_BUCKETS = [PAYMENT_EVIDENCE_BUCKET, RESERVATION_DOCUMENTS_BUCKET] as const;
const PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 100;
const PREFLIGHT_TABLES = ["reservation_snapshots", ...RESERVATION_SCOPED_TABLES] as const;

type CountSummary = Readonly<Record<ReservationScopedTable | "reservations" | "storageObjects", number>>;
type StorageObject = Readonly<{ bucket: (typeof STORAGE_BUCKETS)[number]; path: string }>;
type MaintenancePurgeResult = Readonly<{ status: "deleted" | "already_absent"; reservationCode: string | null }>;

function fail(message: string): never {
  throw new Error(message);
}

function databaseFailure(scope: string, error: unknown): never {
  const databaseError = typeof error === "object" && error !== null ? error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  } : {};
  const safeError = {
    code: typeof databaseError.code === "string" ? databaseError.code : null,
    message: typeof databaseError.message === "string" ? databaseError.message : null,
    details: typeof databaseError.details === "string" ? databaseError.details : null,
    hint: typeof databaseError.hint === "string" ? databaseError.hint : null,
  };
  console.error(`Error Supabase consultando ${scope}:`, safeError);
  const code = safeError.code ? ` (${safeError.code})` : "";
  fail(`No fue posible consultar ${scope}${code}. Verifica que las migraciones requeridas estén aplicadas.`);
}

function chunks<T>(items: readonly T[], size = DELETE_BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push([...items.slice(index, index + size)]);
  return result;
}

function createServiceRoleClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseServerEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function listReservationTargets(supabase: SupabaseClient): Promise<ReservationResetTarget[]> {
  const targets: ReservationResetTarget[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("reservation_snapshots")
      .select("id, agency_id, reservation_code")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) fail("No fue posible leer las reservaciones para el reset.");
    for (const row of data ?? []) {
      if (typeof row.id !== "string" || typeof row.agency_id !== "string" || typeof row.reservation_code !== "string") {
        fail("Se encontró una reservación con estructura inválida.");
      }
      targets.push({ reservationId: row.id, agencyId: row.agency_id, reservationCode: row.reservation_code });
    }
    if ((data ?? []).length < PAGE_SIZE) return targets;
  }
}

async function preflightRequiredTables(supabase: SupabaseClient): Promise<void> {
  for (const table of PREFLIGHT_TABLES) {
    const { error } = await supabase
      .from(table)
      .select("*", { count: "planned", head: true })
      .limit(1);
    if (error) databaseFailure(table, error);
  }
}

async function countByReservationIds(
  supabase: SupabaseClient,
  table: ReservationScopedTable,
  reservationIds: readonly string[],
): Promise<number> {
  let count = 0;
  for (const batch of chunks(reservationIds)) {
    const { count: batchCount, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("reservation_id", batch);
    if (error) databaseFailure(table, error);
    count += batchCount ?? 0;
  }
  return count;
}

async function listStoredPaths(
  supabase: SupabaseClient,
  table: "payment_evidence" | "reservation_documents",
  targets: readonly ReservationResetTarget[],
): Promise<StorageObject[]> {
  const byReservationId = new Map(targets.map((target) => [target.reservationId, target]));
  const result: StorageObject[] = [];
  const bucket = table === "payment_evidence" ? PAYMENT_EVIDENCE_BUCKET : RESERVATION_DOCUMENTS_BUCKET;

  for (const reservationIds of chunks(targets.map((target) => target.reservationId))) {
    const { data, error } = await supabase
      .from(table)
      .select("reservation_id, agency_id, storage_path")
      .in("reservation_id", reservationIds);
    if (error) databaseFailure(`los paths de ${table}`, error);
    for (const row of data ?? []) {
      const target = typeof row.reservation_id === "string" ? byReservationId.get(row.reservation_id) : undefined;
      if (!target || row.agency_id !== target.agencyId || typeof row.storage_path !== "string") {
        fail(`Se encontró metadata de Storage inconsistente en ${table}.`);
      }
      if (!isStoragePathOwnedByReservation(row.storage_path, target)) {
        fail(`Se rechazó un path fuera de la reservación objetivo en ${table}.`);
      }
      result.push({ bucket, path: row.storage_path });
    }
  }
  return result;
}

async function listStoragePrefix(
  supabase: SupabaseClient,
  bucket: (typeof STORAGE_BUCKETS)[number],
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE_SIZE, offset });
    if (error) fail(`No fue posible listar Storage en ${bucket}.`);
    for (const entry of data ?? []) {
      const child = `${prefix}/${entry.name}`;
      if (entry.id === null) paths.push(...await listStoragePrefix(supabase, bucket, child));
      else paths.push(child);
    }
    if ((data ?? []).length < PAGE_SIZE) return paths;
  }
}

async function collectStorageObjects(
  supabase: SupabaseClient,
  targets: readonly ReservationResetTarget[],
): Promise<StorageObject[]> {
  const metadataObjects = [
    ...await listStoredPaths(supabase, "payment_evidence", targets),
    ...await listStoredPaths(supabase, "reservation_documents", targets),
  ];
  const prefixObjects: StorageObject[] = [];
  for (const target of targets) {
    const prefix = storagePrefixForReservation(target);
    for (const bucket of STORAGE_BUCKETS) {
      for (const path of await listStoragePrefix(supabase, bucket, prefix)) {
        if (!isStoragePathOwnedByReservation(path, target)) fail("Se rechazó un objeto Storage fuera del prefijo objetivo.");
        prefixObjects.push({ bucket, path });
      }
    }
  }

  const unique = new Map<string, StorageObject>();
  for (const object of [...metadataObjects, ...prefixObjects]) unique.set(`${object.bucket}:${object.path}`, object);
  return [...unique.values()];
}

async function collectCounts(
  supabase: SupabaseClient,
  targets: readonly ReservationResetTarget[],
  storageObjects: readonly StorageObject[],
): Promise<CountSummary> {
  const reservationIds = targets.map((target) => target.reservationId);
  const entries: [string, number][] = [["reservations", targets.length], ["storageObjects", storageObjects.length]];
  for (const table of RESERVATION_SCOPED_TABLES) entries.push([table, await countByReservationIds(supabase, table, reservationIds)]);
  return Object.fromEntries(entries) as CountSummary;
}

async function collectAllCounts(supabase: SupabaseClient): Promise<CountSummary> {
  const entries: [string, number][] = [];
  for (const table of PREFLIGHT_TABLES) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) databaseFailure(table, error);
    entries.push([table === "reservation_snapshots" ? "reservations" : table, count ?? 0]);
  }
  entries.push(["storageObjects", 0]);
  return Object.fromEntries(entries) as CountSummary;
}

function printSummary(summary: CountSummary): void {
  console.log(`Reservaciones encontradas: ${summary.reservations}`);
  console.log(`Viajeros: ${summary.reservation_travelers}`);
  console.log(`Pagos: ${summary.reservation_payments}`);
  console.log(`Evidencias: ${summary.payment_evidence}`);
  console.log(`Contratos: ${summary.reservation_contract_instances}`);
  console.log(`Aceptaciones: ${summary.reservation_contract_acceptances}`);
  console.log(`Documentos: ${summary.reservation_documents}`);
  console.log(`Accesos customer: ${summary.reservation_customer_access}`);
  console.log(`Credenciales: ${summary.traveler_boarding_credentials}`);
  console.log(`Boarding states: ${summary.traveler_boarding_state}`);
  console.log(`Boarding events: ${summary.traveler_boarding_events}`);
  console.log(`Storage objects: ${summary.storageObjects}`);
}

/** The private RPC owns the single-transaction database purge for one reservation. */
async function purgeReservationDatabase(
  supabase: SupabaseClient,
  target: ReservationResetTarget,
): Promise<MaintenancePurgeResult> {
  const { data, error } = await supabase.rpc("purge_demo_reservation_atomic", {
    target_agency_id: target.agencyId,
    target_reservation_id: target.reservationId,
  });
  if (error) databaseFailure(`la purga de ${target.reservationCode}`, error);
  const row = Array.isArray(data) ? data[0] : data;
  const status = typeof row?.result_status === "string" ? row.result_status : null;
  if (status !== "deleted" && status !== "already_absent") {
    fail(`La purga de ${target.reservationCode} devolvió un estado no esperado.`);
  }
  return {
    status,
    reservationCode: typeof row?.reservation_code === "string" ? row.reservation_code : null,
  };
}

async function removeStorageObjects(
  supabase: SupabaseClient,
  objects: readonly StorageObject[],
): Promise<Readonly<{ deleted: number; failed: number }>> {
  let deleted = 0;
  let failed = 0;
  for (const bucket of STORAGE_BUCKETS) {
    const paths = objects.filter((object) => object.bucket === bucket).map((object) => object.path);
    for (const batch of chunks(paths)) {
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) failed += batch.length;
      else deleted += batch.length;
    }
  }
  return { deleted, failed };
}

async function main(): Promise<void> {
  // `tsx` does not load Next's .env.local automatically. This keeps the
  // command server-only while honoring deployed environment variables first.
  loadEnvConfig(process.cwd());
  const mode = parseDemoReservationResetArgs(process.argv.slice(2));
  const { url } = getSupabaseServerEnvironment();
  const projectRef = getSupabaseProjectRef(url) ?? "no disponible (endpoint no hosted estándar)";
  const runtimeEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "no declarado";
  console.log(`Supabase project ref: ${projectRef}`);
  console.log(`Entorno declarado: ${runtimeEnvironment}`);
  console.log(`Modo: ${mode === "dry-run" ? "dry-run (sin borrados)" : "confirmado"}`);

  const supabase = createServiceRoleClient();
  await preflightRequiredTables(supabase);
  const targets = await listReservationTargets(supabase);
  const storageObjects = await collectStorageObjects(supabase, targets);
  const summary = await collectCounts(supabase, targets, storageObjects);
  printSummary(summary);

  if (mode === "dry-run") {
    console.log(`\nDry-run finalizado. Para solicitar borrado explícito: npm run demo:reset-reservations -- --confirm=${DEMO_RESERVATIONS_RESET_CONFIRMATION}`);
    return;
  }

  console.log(`\nSe eliminarán ${summary.reservations} reservaciones y ${summary.storageObjects} archivos Storage.`);
  console.log(`Orden DB validado: ${RESERVATION_RESET_DELETE_ORDER.join(" → ")}`);

  let storageFailures = 0;
  for (const target of targets) {
    const objects = storageObjects.filter((object) => isStoragePathOwnedByReservation(object.path, target));
    const database = await purgeReservationDatabase(supabase, target);
    const storage = await removeStorageObjects(supabase, objects);
    storageFailures += storage.failed;
    console.log(`${database.reservationCode ?? target.reservationCode}: DB ${database.status === "deleted" ? "deleted" : "already absent"}; Storage ${storage.deleted}/${objects.length} deleted${storage.failed ? `; ${storage.failed} pendientes` : ""}`);
  }

  const remainingStorage = await collectStorageObjects(supabase, targets);
  const after = await collectAllCounts(supabase);
  const reservationRowsRemain = after.reservations + RESERVATION_SCOPED_TABLES.reduce((total, table) => total + after[table], 0);
  if (reservationRowsRemain !== 0) fail("La verificación final detectó datos de reservación pendientes.");
  if (remainingStorage.length !== 0 || storageFailures !== 0) {
    fail(`La base de datos fue purgada, pero quedaron ${remainingStorage.length || storageFailures} objetos Storage para reintentar.`);
  }
  console.log("\nVerificación final correcta: no quedan reservaciones, dependencias ni objetos Storage de este reset.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "No fue posible ejecutar el reset de reservaciones.";
  console.error(message);
  process.exitCode = 1;
});
