import type { CustomerProfileUpdate } from "./customer-profile-core";

export type CustomerAccountOnboardingIdentity = Readonly<{
  userId: string;
  email: string | null;
}>;

export type CustomerAccountOnboardingRecord = Readonly<{
  customerAccountId: string;
  status: string;
}>;

export interface CustomerAccountOnboardingRepository {
  findAccount(input: Readonly<{ agencyId: string; userId: string }>): Promise<CustomerAccountOnboardingRecord | null>;
  createActiveAccount(input: Readonly<{
    agencyId: string;
    userId: string;
    profile: CustomerProfileUpdate;
  }>): Promise<CustomerAccountOnboardingRecord | null>;
}

export type CustomerAccountOnboardingResult =
  | Readonly<{ status: "existing"; email: string }>
  | Readonly<{ status: "profile_required"; email: string }>
  | Readonly<{ status: "created"; email: string }>
  | Readonly<{ status: "unauthenticated" | "account_unavailable" | "error" }>;

/**
 * Account onboarding is deliberately distinct from reservation claim. It can
 * only run after a verified Auth identity is available server-side.
 */
export function createCustomerAccountOnboardingService(dependencies: Readonly<{
  getIdentity: () => Promise<CustomerAccountOnboardingIdentity | null>;
  repository: CustomerAccountOnboardingRepository;
}>) {
  return {
    async inspect(input: Readonly<{ agencyId: string }>): Promise<CustomerAccountOnboardingResult> {
      try {
        const identity = await dependencies.getIdentity();
        if (!identity?.email) return { status: "unauthenticated" };
        const existing = await dependencies.repository.findAccount({ agencyId: input.agencyId, userId: identity.userId });
        if (!existing) return { status: "profile_required", email: identity.email };
        return existing.status === "active"
          ? { status: "existing", email: identity.email }
          : { status: "account_unavailable" };
      } catch {
        return { status: "error" };
      }
    },
    async complete(input: Readonly<{ agencyId: string; profile: CustomerProfileUpdate }>): Promise<CustomerAccountOnboardingResult> {
      try {
        const identity = await dependencies.getIdentity();
        if (!identity?.email) return { status: "unauthenticated" };
        const existing = await dependencies.repository.findAccount({ agencyId: input.agencyId, userId: identity.userId });
        if (existing) {
          return existing.status === "active"
            ? { status: "existing", email: identity.email }
            : { status: "account_unavailable" };
        }
        const created = await dependencies.repository.createActiveAccount({
          agencyId: input.agencyId,
          userId: identity.userId,
          profile: input.profile,
        });
        if (!created) return { status: "error" };
        return created.status === "active"
          ? { status: "created", email: identity.email }
          : { status: "account_unavailable" };
      } catch {
        return { status: "error" };
      }
    },
  };
}
