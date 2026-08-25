import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity-core";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { createReservationClaimService } from "./reservation-claim-core";
import { createSupabaseReservationClaimRepository } from "./reservation-claim-repository";

export * from "./reservation-claim-core";

export async function claimReservationForAuthenticatedCustomer(input: Readonly<{ requestedAgencySlug: string; reservationId: string }>, authenticatedClient?: SupabaseClient) {
  const auth = authenticatedClient ?? await createSupabaseAuthServerClient();
  const result = await createReservationClaimService({
    getIdentity: () => resolveVerifiedSupabaseIdentity(auth),
    repository: createSupabaseReservationClaimRepository(),
  }).claim(input);
  if (result.status === "claimed" || result.status === "existing") {
    const slug = encodeURIComponent(input.requestedAgencySlug);
    revalidatePath("/cuenta", "layout");
    revalidatePath(`/cuenta/${slug}/reservaciones`, "layout");
    revalidatePath(`/cuenta/${slug}/reservaciones/${encodeURIComponent(input.reservationId)}`);
    revalidatePath(`/admin/${slug}/reservaciones/${encodeURIComponent(input.reservationId)}`);
  }
  return result;
}
