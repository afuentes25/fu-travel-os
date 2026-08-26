import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { CustomerProfileRepository } from "./customer-profile-core";

function failure() {
  return new Error("No fue posible actualizar el perfil de cliente.");
}

/** Service-role write with the verified account, agency and Auth user in scope. */
export function createSupabaseCustomerProfileRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerProfileRepository {
  return {
    async updateOwnProfile({ customerAccountId, agencyId, userId, profile }) {
      const { data, error } = await supabase
        .from("agency_customer_accounts")
        .update({
          first_name: profile.firstName,
          last_name: profile.lastName,
          phone: profile.phone,
        })
        .eq("id", customerAccountId)
        .eq("agency_id", agencyId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw failure();
      return Boolean(data);
    },
  };
}
