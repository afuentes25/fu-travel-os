import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ReservationTravelerSlotRow,
  TravelerSlotsRepositoryClient,
} from "./traveler-slots-core";

type LinkedSnapshotRow = Readonly<{
  reservation_snapshots: {
    id: string;
    reservation_code: string;
    status: string;
    currency: "MXN" | "USD";
    created_at: string;
    snapshot: unknown;
  } | {
    id: string;
    reservation_code: string;
    status: string;
    currency: "MXN" | "USD";
    created_at: string;
    snapshot: unknown;
  }[] | null;
}>;

/**
 * Service-role writes happen only after the core has resolved an active
 * customer account. Both link and snapshot are constrained in the same query.
 */
export function createSupabaseTravelerSlotsRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): TravelerSlotsRepositoryClient {
  return {
    async findAuthorizedReservation({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_customer_access")
        .select(
          "reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id, reservation_code, status, currency, created_at, snapshot)",
        )
        .eq("customer_account_id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("reservation_id", reservationId)
        .eq("reservation_snapshots.agency_id", agencyId)
        .maybeSingle();
      if (error) throw new Error("No fue posible consultar la reservación.");

      const linked = data as LinkedSnapshotRow | null;
      const snapshot = Array.isArray(linked?.reservation_snapshots)
        ? linked.reservation_snapshots[0]
        : linked?.reservation_snapshots;
      if (!snapshot) return null;

      const slots = await supabase
        .from("reservation_travelers")
        .select("id, position, traveler_type, status")
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .order("position", { ascending: true });
      if (slots.error) throw new Error("No fue posible consultar los viajeros.");
      return {
        snapshot,
        slots: (slots.data ?? []) as ReservationTravelerSlotRow[],
      };
    },

    async insertMissing({ agencyId, reservationId, slots }) {
      if (!slots.length) return;
      const { error } = await supabase
        .from("reservation_travelers")
        .upsert(
          slots.map((slot) => ({
            reservation_id: reservationId,
            agency_id: agencyId,
            position: slot.position,
            traveler_type: slot.travelerType,
          })),
          { onConflict: "reservation_id,position", ignoreDuplicates: true },
        );
      if (error) throw new Error("No fue posible preparar los viajeros.");
    },
  };
}
