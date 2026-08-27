/*
 * Maintenance-only reconciliation for historical reservation rows that were
 * committed before their primary customer access. Read-only by default.
 */

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { getSupabaseServerEnvironment } from "../lib/supabase/env";
import { getSupabaseProjectRef } from "./reset-demo-reservations-core";
import {
  normalizeMaintenanceEmail,
  ORPHAN_CUSTOMER_ACCESS_CONFIRMATION,
  parseOrphanCustomerAccessArgs,
  type OrphanCustomerAccessCandidate,
} from "./reconcile-orphan-customer-access-core";

const PAGE_SIZE = 500;

type ReservationRow = Readonly<{
  id: string;
  agency_id: string;
  reservation_code: string;
  snapshot: unknown;
  agencies: { slug: string } | { slug: string }[] | null;
}>;

type CustomerAccountRow = Readonly<{
  id: string;
  agency_id: string;
  user_id: string;
  status: string;
}>;

type CustomerAccessRow = Readonly<{
  reservation_id: string;
  agency_id: string;
  customer_account_id: string;
  role: string;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function queryFailure(scope: string, error: unknown): never {
  const source = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
    : {};
  const safe = {
    code: typeof source.code === "string" ? source.code : null,
    message: typeof source.message === "string" ? source.message : null,
    details: typeof source.details === "string" ? source.details : null,
    hint: typeof source.hint === "string" ? source.hint : null,
  };
  console.error(`Error Supabase en ${scope}:`, safe);
  fail(`No fue posible completar el preflight de ${scope}.`);
}

function serviceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseServerEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function bookingEmail(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const contact = (snapshot as Record<string, unknown>).primaryContact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    return null;
  }
  return normalizeMaintenanceEmail((contact as Record<string, unknown>).email);
}

async function listAll<T>(
  scope: string,
  readPage: (from: number, to: number) => Promise<Readonly<{
    data: T[] | null;
    error: unknown;
  }>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await readPage(offset, offset + PAGE_SIZE - 1);
    if (error) queryFailure(scope, error);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

async function listAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) queryFailure("identidades Auth", error);
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) return users;
  }
}

async function findCandidates(
  supabase: SupabaseClient,
): Promise<OrphanCustomerAccessCandidate[]> {
  // All required sources are read before a possible write. A failed preflight
  // therefore cannot leave a partially reconciled data set.
  const [reservations, customerAccounts, customerAccess, authUsers] =
    await Promise.all([
      listAll<ReservationRow>("reservation_snapshots", async (from, to) => {
        const result = await supabase
          .from("reservation_snapshots")
          .select("id,agency_id,reservation_code,snapshot,agencies!inner(slug)")
          .order("id", { ascending: true })
          .range(from, to);
        return { data: result.data as ReservationRow[] | null, error: result.error };
      }),
      listAll<CustomerAccountRow>("agency_customer_accounts", async (from, to) => {
        const result = await supabase
          .from("agency_customer_accounts")
          .select("id,agency_id,user_id,status")
          .order("id", { ascending: true })
          .range(from, to);
        return { data: result.data as CustomerAccountRow[] | null, error: result.error };
      }),
      listAll<CustomerAccessRow>("reservation_customer_access", async (from, to) => {
        const result = await supabase
          .from("reservation_customer_access")
          .select("reservation_id,agency_id,customer_account_id,role")
          .order("reservation_id", { ascending: true })
          .range(from, to);
        return { data: result.data as CustomerAccessRow[] | null, error: result.error };
      }),
      listAuthUsers(supabase),
    ]);

  const authByEmail = new Map<string, User[]>();
  for (const user of authUsers) {
    const email = normalizeMaintenanceEmail(user.email);
    if (!email) continue;
    authByEmail.set(email, [...(authByEmail.get(email) ?? []), user]);
  }

  const accessByReservation = new Map<string, CustomerAccessRow[]>();
  for (const access of customerAccess) {
    accessByReservation.set(access.reservation_id, [
      ...(accessByReservation.get(access.reservation_id) ?? []),
      access,
    ]);
  }

  return reservations.flatMap((reservation) => {
    const email = bookingEmail(reservation.snapshot);
    if (!email) return [];
    const authMatches = authByEmail.get(email) ?? [];
    if (authMatches.length !== 1) return [];
    const access = accessByReservation.get(reservation.id) ?? [];
    if (access.length !== 0 || access.some((row) => row.role === "primary")) {
      return [];
    }
    const accounts = customerAccounts.filter(
      (account) =>
        account.agency_id === reservation.agency_id &&
        account.user_id === authMatches[0].id &&
        account.status === "active",
    );
    if (accounts.length !== 1) return [];
    const agency = Array.isArray(reservation.agencies)
      ? reservation.agencies[0]
      : reservation.agencies;
    if (!agency?.slug) return [];
    return [
      {
        agencyId: reservation.agency_id,
        agencySlug: agency.slug,
        reservationRowId: reservation.id,
        reservationCode: reservation.reservation_code,
        verifiedAuthUserId: authMatches[0].id,
      },
    ];
  });
}

async function reconcileCandidate(
  supabase: SupabaseClient,
  candidate: OrphanCustomerAccessCandidate,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "reconcile_orphan_customer_access_atomic",
    {
      target_agency_id: candidate.agencyId,
      target_reservation_id: candidate.reservationRowId,
      target_verified_auth_user_id: candidate.verifiedAuthUserId,
    },
  );
  if (error) fail(`No fue posible reconciliar ${candidate.reservationCode}.`);
  const row = Array.isArray(data) ? data[0] : data;
  const status = typeof row?.result_status === "string" ? row.result_status : null;
  if (status !== "linked" && status !== "already_linked") {
    fail(`${candidate.reservationCode} dejó de cumplir las condiciones seguras.`);
  }
  return status;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const mode = parseOrphanCustomerAccessArgs(process.argv.slice(2));
  const { url } = getSupabaseServerEnvironment();
  console.log(`Supabase project ref: ${getSupabaseProjectRef(url) ?? "no disponible"}`);
  console.log(`Modo: ${mode === "dry-run" ? "dry-run (sin escrituras)" : "confirmado"}`);

  const supabase = serviceClient();
  const candidates = await findCandidates(supabase);
  console.log(`Reservaciones huérfanas elegibles: ${candidates.length}`);
  for (const candidate of candidates) {
    console.log(`${candidate.reservationCode} · ${candidate.agencySlug} · resultado esperado: linked`);
  }

  if (mode === "dry-run") {
    console.log(
      `Dry-run finalizado. Confirmación requerida: npm run maintenance:reconcile-customer-access -- --confirm=${ORPHAN_CUSTOMER_ACCESS_CONFIRMATION}`,
    );
    return;
  }

  for (const candidate of candidates) {
    const status = await reconcileCandidate(supabase, candidate);
    console.log(`${candidate.reservationCode} · ${status}`);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No fue posible reconciliar los accesos customer.",
  );
  process.exitCode = 1;
});
