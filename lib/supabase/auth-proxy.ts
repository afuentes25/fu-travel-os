import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnvironment } from "./auth-env";

/**
 * Refreshes the authenticated session while preserving the incoming request,
 * including its Host header used by the existing tenant resolver.
 */
export async function updateSupabaseAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnvironment();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        const refreshedResponse = NextResponse.next({ request });
        response.headers.forEach((value, key) =>
          refreshedResponse.headers.set(key, value),
        );
        response = refreshedResponse;

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}
