import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TicketLifecycleRepository } from "./ticket-lifecycle-core";

export function createSupabaseTicketLifecycleRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): TicketLifecycleRepository {
  return {
    async hasAvailableTickets({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_documents").select("id")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("document_type", "ticket").eq("status", "available").maybeSingle();
      if (error) throw new Error("No fue posible reconciliar los boletos.");
      return Boolean(data);
    },
    async revokeAvailableTickets({ agencyId, reservationId }) {
      const { error } = await supabase.rpc("revoke_available_tickets_with_credentials_atomic", {
        target_agency_id: agencyId, target_reservation_id: reservationId, target_traveler_id: null,
      });
      if (error) throw new Error("No fue posible reconciliar los boletos.");
    },
    async findTravelerByPosition({ agencyId, reservationId, position }) {
      const { data, error } = await supabase.from("reservation_travelers").select("id")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("position", position).maybeSingle();
      if (error) throw new Error("No fue posible resolver el viajero.");
      return data && typeof data.id === "string" ? { id: data.id } : null;
    },
    async revokeAvailableTicketsForTraveler({ agencyId, reservationId, travelerId }) {
      const { error } = await supabase.rpc("revoke_available_tickets_with_credentials_atomic", {
        target_agency_id: agencyId, target_reservation_id: reservationId, target_traveler_id: travelerId,
      });
      if (error) throw new Error("No fue posible reconciliar los boletos.");
    },
  };
}
