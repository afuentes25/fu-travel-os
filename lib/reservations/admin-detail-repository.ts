import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import {
  createAdminReservationDetail,
  type AdminReservationDetailRepositoryClient,
  type AdminReservationDetailRow,
  type AdminReservationTravelerRow,
} from "./admin-detail";

export {
  AdminReservationDetailError,
  isAdminReservationUuid,
  type AdminReservationDetail,
  type AdminReservationDetailInput,
  type AdminReservationDetailRepositoryClient,
  type AdminReservationDetailRow,
  type AdminReservationTravelerRow,
} from "./admin-detail";

/**
 * Server-only detail repository. Its query constrains the immutable snapshot
 * by reservation id and the already-authorized agency UUID in one operation.
 */
export function createAdminReservationDetailRepository(
  client: AdminReservationDetailRepositoryClient =
    createSupabaseAdminReservationDetailClient(),
) {
  return createAdminReservationDetail({ reservationClient: client });
}

export function createSupabaseAdminReservationDetailClient(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminReservationDetailRepositoryClient {
  return {
    async find({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw new Error("No fue posible consultar la reservación.");
      return data ? (data as AdminReservationDetailRow) : null;
    },
    async listTravelers({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_travelers")
        .select("position, traveler_type, status, first_name, last_name")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .order("position", { ascending: true });
      if (error) throw new Error("No fue posible consultar los viajeros.");
      return (data ?? []) as AdminReservationTravelerRow[];
    },
  };
}
