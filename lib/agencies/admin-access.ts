import "server-only";

import { getVerifiedSupabaseIdentity } from "@/lib/supabase/auth-identity";

import {
  createAdminAgencyAccessResolver,
  type AdminAgencyAccess,
} from "./admin-access-core";
import { createSupabaseAdminAgencyMembershipRepository } from "./admin-access-repository";

export {
  AdminAgencyAccessError,
  type AdminAgencyAccess,
  type AdminAgencyMembership,
  type AdminAgencyRole,
} from "./admin-access-core";

/** Resolves access only from the verified session and persisted memberships. */
export async function resolveAdminAgencyAccess(
  input: Readonly<{ requestedAgencySlug?: string }> = {},
): Promise<AdminAgencyAccess> {
  return createAdminAgencyAccessResolver({
    getIdentity: getVerifiedSupabaseIdentity,
    membershipRepository: createSupabaseAdminAgencyMembershipRepository(),
  }).resolve(input);
}
