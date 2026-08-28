import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { ReservationTravelerMaterializationRepository } from "./traveler-materialization-core";

export function createSupabaseReservationTravelerMaterializationRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ReservationTravelerMaterializationRepository {
  return {
    async insertMissing({ agencyId, reservationId, travelers }) {
      if (!travelers.length) return;
      const { error } = await supabase
        .from("reservation_travelers")
        .upsert(
          travelers.map((traveler) => ({
            agency_id: agencyId,
            reservation_id: reservationId,
            position: traveler.position,
            traveler_type: traveler.travelerType,
            first_name: traveler.firstName,
            last_name: traveler.lastName,
            birth_date: traveler.birthDate,
            status: traveler.status,
          })),
          {
            onConflict: "reservation_id,position",
            ignoreDuplicates: true,
          },
        );
      if (error) throw new Error("No fue posible preparar los viajeros.");
    },
  };
}
