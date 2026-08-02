import "server-only";

import { getVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import {
  createCustomerAgencyAccessResolver,
  type CustomerAgencyAccess,
} from "./customer-access-core";
import { createSupabaseCustomerAgencyAccountRepository } from "./customer-access-repository";

export {
  CustomerAgencyAccessError,
  type CustomerAgencyAccess,
  type CustomerAgencyAccount,
} from "./customer-access-core";

/** Resolves customer access only from the verified session and RLS-scoped accounts. */
export async function resolveCustomerAgencyAccess(
  input: Readonly<{ requestedAgencySlug?: string }> = {},
): Promise<CustomerAgencyAccess> {
  const client = await createSupabaseAuthServerClient();
  return createCustomerAgencyAccessResolver({
    getIdentity: getVerifiedSupabaseIdentity,
    accountRepository: createSupabaseCustomerAgencyAccountRepository(client),
  }).resolve(input);
}
