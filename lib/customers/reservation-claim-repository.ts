import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { ClaimReservationRow, ReservationClaimRepository } from "./reservation-claim-core";

function failure() { return new Error("No fue posible resolver la vinculación de la reservación."); }
function bookingEmail(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const contact = (snapshot as Record<string, unknown>).primaryContact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) return null;
  return typeof (contact as Record<string, unknown>).email === "string" ? (contact as Record<string, unknown>).email : null;
}

export function createSupabaseReservationClaimRepository(supabase: SupabaseClient = getSupabaseServerClient()): ReservationClaimRepository {
  return {
    async findReservation({ requestedAgencySlug, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots").select("agency_id,snapshot,agencies!inner(slug)").eq("id", reservationId).eq("agencies.slug", requestedAgencySlug).maybeSingle();
      if (error) throw failure();
      if (!data) return null;
      return { agencyId: String(data.agency_id), bookingEmail: bookingEmail(data.snapshot) } as ClaimReservationRow;
    },
    async findOrCreateActiveAccount({ agencyId, userId }) {
      const { data: existing, error: existingError } = await supabase.from("agency_customer_accounts").select("id,status").eq("agency_id", agencyId).eq("user_id", userId).maybeSingle();
      if (existingError) throw failure();
      if (existing) return existing.status === "active" ? String(existing.id) : null;
      const { data, error } = await supabase.from("agency_customer_accounts").insert({ agency_id: agencyId, user_id: userId, status: "active" }).select("id,status").single();
      if (!error) return data.status === "active" ? String(data.id) : null;
      if ((error as { code?: string }).code !== "23505") throw failure();
      const { data: concurrent, error: concurrentError } = await supabase.from("agency_customer_accounts").select("id,status").eq("agency_id", agencyId).eq("user_id", userId).maybeSingle();
      if (concurrentError) throw failure();
      return concurrent?.status === "active" ? String(concurrent.id) : null;
    },
    async findPrimaryAccountId({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_customer_access").select("customer_account_id").eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("role", "primary").maybeSingle();
      if (error) throw failure();
      return data ? String(data.customer_account_id) : null;
    },
    async upsertPrimaryAccess({ agencyId, reservationId, customerAccountId }) {
      const { error } = await supabase.from("reservation_customer_access").upsert({ agency_id: agencyId, reservation_id: reservationId, customer_account_id: customerAccountId, role: "primary" }, { onConflict: "reservation_id,customer_account_id" });
      if (error) {
        const result = new Error("No fue posible vincular la reservación.") as Error & { code?: string };
        result.code = (error as { code?: string }).code;
        throw result;
      }
    },
  };
}
