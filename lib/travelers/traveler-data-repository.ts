import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ReservationTravelerDataRow,
  TravelerDataRepositoryClient,
} from "./traveler-data-core";

async function hasAuthorizedReservation(
  supabase: SupabaseClient,
  input: Readonly<{ customerAccountId: string; agencyId: string; reservationId: string }>,
) {
  const { data, error } = await supabase
    .from("reservation_customer_access")
    .select("reservation_id")
    .eq("customer_account_id", input.customerAccountId)
    .eq("agency_id", input.agencyId)
    .eq("reservation_id", input.reservationId)
    .maybeSingle();
  if (error) throw new Error("No fue posible validar la reservación.");
  return data !== null;
}

/** Service-role PII access remains server-only and is re-scoped per operation. */
export function createSupabaseTravelerDataRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): TravelerDataRepositoryClient {
  return {
    async listAuthorized(input) {
      if (!await hasAuthorizedReservation(supabase, input)) return null;
      const { data, error } = await supabase
        .from("reservation_travelers")
        .select("position, traveler_type, status, first_name, last_name, birth_date")
        .eq("reservation_id", input.reservationId)
        .eq("agency_id", input.agencyId)
        .order("position", { ascending: true });
      if (error) throw new Error("No fue posible consultar los viajeros.");
      return (data ?? []) as ReservationTravelerDataRow[];
    },

    async updateAuthorized(input) {
      if (!await hasAuthorizedReservation(supabase, input)) return null;
      const { data, error } = await supabase
        .from("reservation_travelers")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          birth_date: input.birthDate,
          status: "complete",
        })
        .eq("reservation_id", input.reservationId)
        .eq("agency_id", input.agencyId)
        .eq("position", input.position)
        .select("position, traveler_type, status, first_name, last_name, birth_date")
        .maybeSingle();
      if (error) throw new Error("No fue posible guardar los datos del viajero.");
      return data ? data as ReservationTravelerDataRow : null;
    },
  };
}
