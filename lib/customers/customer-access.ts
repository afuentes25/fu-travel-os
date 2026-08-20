import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity-core";
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
  authenticatedClient?: SupabaseClient,
): Promise<CustomerAgencyAccess> {
  const client = authenticatedClient ?? await createSupabaseAuthServerClient();
  return createCustomerAgencyAccessResolver({
    getIdentity: () => resolveVerifiedSupabaseIdentity(client),
    accountRepository: createSupabaseCustomerAgencyAccountRepository(client),
  }).resolve(input);
}
