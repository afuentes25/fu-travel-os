import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { CustomerAccountOnboardingRepository } from "./customer-account-onboarding-core";

type AccountRow = Readonly<{ id: string; status: string }>;

function failure() {
  return new Error("No fue posible preparar la cuenta de cliente.");
}

/** Service-role adapter; the caller has already resolved the verified Auth identity. */
export function createSupabaseCustomerAccountOnboardingRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerAccountOnboardingRepository {
  const findAccount = async (input: Readonly<{ agencyId: string; userId: string }>) => {
    const { data, error } = await supabase
      .from("agency_customer_accounts")
      .select("id,status")
      .eq("agency_id", input.agencyId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (error) throw failure();
    return data ? { customerAccountId: String((data as AccountRow).id), status: String((data as AccountRow).status) } : null;
  };
  return {
    findAccount,
    async createActiveAccount(input) {
      const { data, error } = await supabase
        .from("agency_customer_accounts")
        .insert({
          agency_id: input.agencyId,
          user_id: input.userId,
          status: "active",
          first_name: input.profile.firstName,
          last_name: input.profile.lastName,
          phone: input.profile.phone,
        })
        .select("id,status")
        .maybeSingle();
      if (!error) return data ? { customerAccountId: String((data as AccountRow).id), status: String((data as AccountRow).status) } : null;
      if ((error as { code?: string }).code !== "23505") throw failure();
      return findAccount({ agencyId: input.agencyId, userId: input.userId });
    },
  };
}
