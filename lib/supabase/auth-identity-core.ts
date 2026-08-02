import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifiedSupabaseIdentity = Readonly<{
  userId: string;
  email: string | null;
}>;

/** Projects only verified claims; metadata never participates in identity. */
export async function resolveVerifiedSupabaseIdentity(
  client: Pick<SupabaseClient, "auth">,
): Promise<VerifiedSupabaseIdentity | null> {
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims) return null;

  const claims = data.claims as { sub?: unknown; email?: unknown };
  if (typeof claims.sub !== "string" || !claims.sub) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
