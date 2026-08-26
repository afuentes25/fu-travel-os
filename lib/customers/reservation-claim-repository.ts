import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { ClaimReservationRow, ReservationClaimRepository } from "./reservation-claim-core";

function failure() { return new Error("No fue posible resolver la vinculación de la reservación."); }
function bookingContact(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const contact = (snapshot as Record<string, unknown>).primaryContact;
  return contact && typeof contact === "object" && !Array.isArray(contact)
    ? contact as Record<string, unknown>
    : null;
}

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

export function createSupabaseReservationClaimRepository(supabase: SupabaseClient = getSupabaseServerClient()): ReservationClaimRepository {
  return {
    async findReservation({ requestedAgencySlug, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots").select("agency_id,snapshot,agencies!inner(slug)").eq("id", reservationId).eq("agencies.slug", requestedAgencySlug).maybeSingle();
      if (error) throw failure();
      if (!data) return null;
      const contact = bookingContact(data.snapshot);
      return {
        agencyId: String(data.agency_id),
        bookingEmail: optionalText(contact?.email, 320),
        bookingProfile: {
          firstName: optionalText(contact?.firstName, 120),
          lastName: optionalText(contact?.lastName, 120),
          phone: optionalText(contact?.phone, 60),
        },
      } as ClaimReservationRow;
    },
    async findOrCreateActiveAccount({ agencyId, userId, profile }) {
      const { data: existing, error: existingError } = await supabase.from("agency_customer_accounts").select("id,status").eq("agency_id", agencyId).eq("user_id", userId).maybeSingle();
      if (existingError) throw failure();
      if (existing) return existing.status === "active" ? String(existing.id) : null;
      const { data, error } = await supabase.from("agency_customer_accounts").insert({
        agency_id: agencyId,
        user_id: userId,
        status: "active",
        first_name: profile?.firstName ?? null,
        last_name: profile?.lastName ?? null,
        phone: profile?.phone ?? null,
      }).select("id,status").single();
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
