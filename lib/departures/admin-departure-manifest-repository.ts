import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import type {
  AdminDepartureManifestRepository,
  DepartureBoardingStateRow,
  DepartureCredentialRow,
  DepartureIdentity,
  DepartureTicketRow,
  DepartureTravelerRow,
} from "./admin-departure-manifest-core";

function unavailable() {
  return new Error("No fue posible cargar el manifiesto de la salida.");
}

function snapshotColumns() {
  return "id,reservation_code,status,currency,created_at,snapshot";
}

/** Bulk, tenant-scoped adapter. It deliberately never requests boarding events. */
export function createSupabaseAdminDepartureManifestRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminDepartureManifestRepository {
  return {
    async listRecentSnapshots({ agencyId, since }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select(snapshotColumns())
        .eq("agency_id", agencyId)
        .gte("snapshot->departure->>startDate", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw unavailable();
      return (data ?? []) as unknown as ReservationSnapshotProjectionSource[];
    },
    async listDepartureSnapshots({ agencyId, identity }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select(snapshotColumns())
        .eq("agency_id", agencyId)
        .eq("snapshot->tour->>id", identity.tourId)
        .eq("snapshot->departure->>id", identity.departureId)
        .order("reservation_code", { ascending: true });
      if (error) throw unavailable();
      return (data ?? []) as unknown as ReservationSnapshotProjectionSource[];
    },
    async listTravelers({ agencyId, reservationIds }) {
      if (!reservationIds.length) return [];
      const { data, error } = await supabase
        .from("reservation_travelers")
        .select("id,reservation_id,position,traveler_type,first_name,last_name")
        .eq("agency_id", agencyId)
        .in("reservation_id", [...reservationIds])
        .order("position", { ascending: true });
      if (error) throw unavailable();
      return (data ?? []).map((row) => ({
        id: String(row.id), reservationId: String(row.reservation_id), position: Number(row.position), travelerType: String(row.traveler_type),
        firstName: typeof row.first_name === "string" ? row.first_name : null,
        lastName: typeof row.last_name === "string" ? row.last_name : null,
      })) satisfies DepartureTravelerRow[];
    },
    async listTickets({ agencyId, reservationIds }) {
      if (!reservationIds.length) return [];
      const { data, error } = await supabase
        .from("reservation_documents")
        .select("id,reservation_id,reservation_traveler_id,status")
        .eq("agency_id", agencyId)
        .eq("document_type", "ticket")
        .in("reservation_id", [...reservationIds]);
      if (error) throw unavailable();
      return (data ?? []).flatMap((row) => row.reservation_traveler_id ? [{
        id: String(row.id), reservationId: String(row.reservation_id), travelerId: String(row.reservation_traveler_id), status: String(row.status),
      } satisfies DepartureTicketRow] : []);
    },
    async listCredentials({ agencyId, reservationIds }) {
      if (!reservationIds.length) return [];
      const { data, error } = await supabase
        .from("traveler_boarding_credentials")
        .select("reservation_id,reservation_traveler_id,ticket_document_id,status")
        .eq("agency_id", agencyId)
        .in("reservation_id", [...reservationIds]);
      if (error) throw unavailable();
      return (data ?? []).map((row) => ({
        reservationId: String(row.reservation_id), travelerId: String(row.reservation_traveler_id), ticketDocumentId: String(row.ticket_document_id), status: String(row.status),
      })) satisfies DepartureCredentialRow[];
    },
    async listBoardingStates({ agencyId, reservationIds }) {
      if (!reservationIds.length) return [];
      const { data, error } = await supabase
        .from("traveler_boarding_state")
        .select("reservation_id,reservation_traveler_id,status,checked_in_at,boarded_at")
        .eq("agency_id", agencyId)
        .in("reservation_id", [...reservationIds]);
      if (error) throw unavailable();
      return (data ?? []).map((row) => ({
        reservationId: String(row.reservation_id), travelerId: String(row.reservation_traveler_id), status: String(row.status),
        checkedInAt: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
        boardedAt: typeof row.boarded_at === "string" ? row.boarded_at : null,
      })) satisfies DepartureBoardingStateRow[];
    },
  };
}
