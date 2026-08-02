import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabasePublicEnvironment } from "./auth-env";

/**
 * Authenticated server client backed by the active request cookies. Cookie
 * writes can be unavailable in Server Components; the proxy performs refreshes.
 */
export async function createSupabaseAuthServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnvironment();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes
          // them on the next request without exposing tokens to this module.
        }
      },
    },
  });
}
