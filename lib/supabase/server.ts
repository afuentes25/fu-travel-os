import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerEnvironment } from "@/lib/supabase/env";

let serverClient: SupabaseClient | undefined;

/**
 * Server-only client for future Route Handlers and Server Actions. Do not
 * import this module from Client Components: it uses a service-role key.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (!serverClient) {
    const { serviceRoleKey, url } = getSupabaseServerEnvironment();

    serverClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return serverClient;
}
