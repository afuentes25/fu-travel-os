import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findPersistedAgencyBySlug } from "@/lib/agencies/supabase-repository";
import { resolveVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity-core";

import { createCustomerAccountOnboardingService } from "./customer-account-onboarding-core";
import { createSupabaseCustomerAccountOnboardingRepository } from "./customer-account-onboarding-repository";

export * from "./customer-account-onboarding-core";

export async function inspectVerifiedCustomerAccount(input: Readonly<{
  requestedAgencySlug: string;
  authenticatedClient: SupabaseClient;
}>) {
  const agency = await findPersistedAgencyBySlug(input.requestedAgencySlug);
  if (!agency) return { status: "error" as const };
  return createCustomerAccountOnboardingService({
    getIdentity: () => resolveVerifiedSupabaseIdentity(input.authenticatedClient),
    repository: createSupabaseCustomerAccountOnboardingRepository(),
  }).inspect({ agencyId: agency.id });
}

export async function completeVerifiedCustomerAccount(input: Readonly<{
  requestedAgencySlug: string;
  authenticatedClient: SupabaseClient;
  profile: import("./customer-profile-core").CustomerProfileUpdate;
}>) {
  const agency = await findPersistedAgencyBySlug(input.requestedAgencySlug);
  if (!agency) return { status: "error" as const };
  return createCustomerAccountOnboardingService({
    getIdentity: () => resolveVerifiedSupabaseIdentity(input.authenticatedClient),
    repository: createSupabaseCustomerAccountOnboardingRepository(),
  }).complete({ agencyId: agency.id, profile: input.profile });
}
