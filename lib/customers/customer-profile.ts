import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { resolveCustomerAgencyAccess } from "./customer-access";
import { type CustomerProfile, createCustomerProfileService } from "./customer-profile-core";
import { createSupabaseCustomerProfileRepository } from "./customer-profile-repository";

export * from "./customer-profile-core";

export async function updateAuthenticatedCustomerProfile(input: Readonly<{
  requestedAgencySlug: string;
  firstName: unknown;
  lastName: unknown;
  phone: unknown;
}>) {
  const result = await createCustomerProfileService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: createSupabaseCustomerProfileRepository,
  }).update(input);
  if (result.status === "updated") {
    const slug = encodeURIComponent(input.requestedAgencySlug);
    revalidatePath("/cuenta", "layout");
    revalidatePath(`/cuenta/${slug}/reservaciones`, "layout");
    revalidatePath(`/admin/${slug}/reservaciones`, "layout");
  }
  return result;
}

/** Safe SSR checkout projection. Auth supplies email; agency account supplies optional profile fields. */
export async function resolveAuthenticatedCustomerCheckoutProfile(input: Readonly<{
  requestedAgencySlug: string;
}>): Promise<CustomerProfile | null> {
  const auth = await createSupabaseAuthServerClient();
  const access = await resolveCustomerAgencyAccess({ requestedAgencySlug: input.requestedAgencySlug }, auth);
  if (access.status === "authorized") {
    return {
      email: access.identity.email,
      firstName: access.account.firstName ?? null,
      lastName: access.account.lastName ?? null,
      phone: access.account.phone ?? null,
    };
  }
  const { resolveVerifiedSupabaseIdentity } = await import("@/lib/supabase/auth-identity-core");
  const identity = await resolveVerifiedSupabaseIdentity(auth);
  return identity ? { email: identity.email, firstName: null, lastName: null, phone: null } : null;
}
