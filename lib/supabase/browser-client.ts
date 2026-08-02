"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnvironment } from "./auth-env";

let browserClient: SupabaseClient | undefined;

/** Browser-safe authenticated client. It intentionally uses no server secrets. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicEnvironment();
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
