import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CustomerAgencyAccountRecord,
  CustomerAgencyAccountRepositoryClient,
} from "./customer-access-core";

type SupabaseCustomerAccountRow = Readonly<{
  id: string;
  agency_id: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  agencies: { slug: string; name: string } | { slug: string; name: string }[] | null;
}>;

function safeCustomerAccountRepositoryError() {
  return new Error("No fue posible resolver las cuentas de cliente.");
}

/**
 * Uses the authenticated SSR client and RLS, while still constraining every
 * query to the already verified user id and active customer accounts.
 */
export function createSupabaseCustomerAgencyAccountRepository(
  supabase: SupabaseClient,
): CustomerAgencyAccountRepositoryClient {
  return {
    async listActiveByUserId(userId) {
      const { data, error } = await supabase
        .from("agency_customer_accounts")
        .select("id, agency_id, status, first_name, last_name, phone, agencies!inner(slug, name)")
        .eq("user_id", userId)
        .eq("status", "active");
      if (error) throw safeCustomerAccountRepositoryError();

      return (data ?? []).flatMap((row) => {
        const account = row as SupabaseCustomerAccountRow;
        const agency = Array.isArray(account.agencies)
          ? account.agencies[0]
          : account.agencies;
        return agency
          ? [{
              customerAccountId: account.id,
              agencyId: account.agency_id,
              agencySlug: agency.slug,
              agencyName: agency.name,
              status: account.status,
              firstName: typeof account.first_name === "string" ? account.first_name : null,
              lastName: typeof account.last_name === "string" ? account.last_name : null,
              phone: typeof account.phone === "string" ? account.phone : null,
            }]
          : [];
      });
    },
  };
}
