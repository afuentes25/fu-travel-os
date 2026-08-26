import "server-only";

import { resolveVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity-core";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { resolveAuthenticatedCustomerCheckoutProfile } from "./customer-profile";

export type PublicCustomerCheckoutProfile = Readonly<{
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}>;

/** Minimal safe projection for storefront presentation; no account IDs leave SSR. */
export async function resolvePublicCustomerEmail(): Promise<string | null> {
  try {
    const identity = await resolveVerifiedSupabaseIdentity(
      await createSupabaseAuthServerClient(),
    );
    return identity?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * The public checkout receives only the authenticated customer's safe profile
 * projection for the agency currently being viewed. The browser never proves
 * identity with a user id or email supplied by a form.
 */
export async function resolvePublicCustomerCheckoutProfile(input: Readonly<{
  requestedAgencySlug: string;
}>): Promise<PublicCustomerCheckoutProfile | null> {
  try {
    return await resolveAuthenticatedCustomerCheckoutProfile(input);
  } catch {
    return null;
  }
}
