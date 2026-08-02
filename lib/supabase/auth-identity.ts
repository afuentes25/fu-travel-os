import "server-only";

import { createSupabaseAuthServerClient } from "./auth-server";
import {
  resolveVerifiedSupabaseIdentity,
  type VerifiedSupabaseIdentity,
} from "./auth-identity-core";

export type { VerifiedSupabaseIdentity } from "./auth-identity-core";

/** Returns identity from verified JWT claims, or null when no valid session exists. */
export async function getVerifiedSupabaseIdentity(): Promise<VerifiedSupabaseIdentity | null> {
  return resolveVerifiedSupabaseIdentity(await createSupabaseAuthServerClient());
}
