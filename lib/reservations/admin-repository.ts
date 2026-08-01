import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPersistedAgencyResolver,
} from "@/lib/agencies";
import { createSupabaseAgencyRepositoryClient } from "@/lib/agencies/supabase-repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  createAdminReservationListing,
  type AdminReservationListRepositoryClient,
  type AdminReservationListRow,
  type PersistedAgencyResolver,
} from "./admin-listing";

export {
  AdminReservationListError,
  type AdminReservationListInput,
  type AdminReservationListItem,
  type AdminReservationListRepositoryClient,
  type AdminReservationListRow,
} from "./admin-listing";

/**
 * Creates a server-only, agency-scoped reservation listing repository.
 * Its returned DTO deliberately excludes the immutable snapshot and traveler PII.
 */
export function createAdminReservationRepository(dependencies: Readonly<{
  agencyResolver?: PersistedAgencyResolver;
  reservationClient?: AdminReservationListRepositoryClient;
}> = {}) {
  const agencyResolver =
    dependencies.agencyResolver ??
    createPersistedAgencyResolver(createSupabaseAgencyRepositoryClient());
  const reservationClient =
    dependencies.reservationClient ?? createSupabaseAdminReservationListClient();

  return createAdminReservationListing({ agencyResolver, reservationClient });
}

/** Supabase adapter kept separate so tests can inject an in-memory client. */
export function createSupabaseAdminReservationListClient(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminReservationListRepositoryClient {
  return {
    async list({ agencyId, status, limit, offset }) {
      let query = supabase
        .from("reservation_snapshots")
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("agency_id", agencyId);
      if (status) query = query.eq("status", status);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []) as AdminReservationListRow[];
    },
  };
}
