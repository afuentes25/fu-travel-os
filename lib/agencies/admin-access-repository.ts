import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AdminAgencyMembershipRecord,
  AdminAgencyMembershipRepositoryClient,
} from "./admin-access-core";

type SupabaseMembershipRow = Readonly<{
  agency_id: string;
  role: string;
  status: string;
  agencies: { slug: string; name: string } | { slug: string; name: string }[] | null;
}>;

function safeMembershipRepositoryError() {
  return new Error("No fue posible resolver las membresías administrativas.");
}

/**
 * Server-only service-role adapter. Its caller supplies an already verified
 * user id; every query remains constrained to that id and active memberships.
 */
export function createSupabaseAdminAgencyMembershipRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminAgencyMembershipRepositoryClient {
  return {
    async listByUserId(userId) {
      const { data, error } = await supabase
        .from("agency_memberships")
        .select("agency_id, role, status, agencies!inner(slug, name)")
        .eq("user_id", userId)
        .eq("status", "active");
      if (error) throw safeMembershipRepositoryError();

      return (data ?? []).flatMap((row) => {
        const membership = row as SupabaseMembershipRow;
        const agency = Array.isArray(membership.agencies)
          ? membership.agencies[0]
          : membership.agencies;
        return agency
          ? [
              {
                agencyId: membership.agency_id,
                agencySlug: agency.slug,
                agencyName: agency.name,
                role: membership.role,
                status: membership.status,
              },
            ]
          : [];
      });
    },
  };
}
