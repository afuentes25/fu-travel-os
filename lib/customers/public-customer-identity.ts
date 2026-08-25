import "server-only";

import { resolveVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity-core";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

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
