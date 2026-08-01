import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPersistedAgencyResolver,
  type PersistedAgency,
  type PersistedAgencyRepositoryClient,
} from "@/lib/agencies";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseAgencyRow = PersistedAgency;

function safeRepositoryError() {
  return new Error("No fue posible resolver la agencia persistida.");
}

/** Server-only adapter; it exposes only the persisted agency identity. */
export function createSupabaseAgencyRepositoryClient(
  supabase: SupabaseClient = getSupabaseServerClient(),
): PersistedAgencyRepositoryClient {
  return {
    async findBySlug(slug) {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw safeRepositoryError();
      return data ? (data as SupabaseAgencyRow) : null;
    },
  };
}

export async function findPersistedAgencyBySlug(slug: string) {
  return createPersistedAgencyResolver(
    createSupabaseAgencyRepositoryClient(),
  ).findBySlug(slug);
}
