import type { CustomerAgencyAccess } from "./customer-access-core";

export type CustomerProfile = Readonly<{
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
}>;

export type CustomerProfileInput = Readonly<{
  firstName: unknown;
  lastName: unknown;
  phone: unknown;
}>;

export type CustomerProfileUpdate = Readonly<{
  firstName: string;
  lastName: string | null;
  phone: string | null;
}>;

export interface CustomerProfileRepository {
  updateOwnProfile(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    userId: string;
    profile: CustomerProfileUpdate;
  }>): Promise<boolean>;
}

export type UpdateCustomerProfileResult =
  | Readonly<{ status: "updated"; profile: CustomerProfileUpdate }>
  | Readonly<{ status: "invalid"; field: "firstName" | "lastName" | "phone" }>
  | Readonly<{ status: "unauthenticated" | "forbidden" | "selection_required" | "profile_error" }>;

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

export function normalizeCustomerProfileInput(input: CustomerProfileInput): CustomerProfileUpdate | null {
  const firstName = optionalText(input.firstName, 120);
  if (!firstName) return null;
  const lastName = optionalText(input.lastName, 120);
  const phone = optionalText(input.phone, 60);
  if (typeof input.lastName === "string" && input.lastName.trim() && !lastName) return null;
  if (typeof input.phone === "string" && input.phone.trim() && !phone) return null;
  return { firstName, lastName, phone };
}

/** Server-side orchestration; ownership is always resolved before mutation. */
export function createCustomerProfileService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerProfileRepository | (() => CustomerProfileRepository);
}>) {
  const repository = () => typeof dependencies.repository === "function"
    ? dependencies.repository()
    : dependencies.repository;
  return {
    async update(input: Readonly<{
      requestedAgencySlug?: string;
      firstName: unknown;
      lastName: unknown;
      phone: unknown;
    }>): Promise<UpdateCustomerProfileResult> {
      const profile = normalizeCustomerProfileInput(input);
      if (!profile) return { status: "invalid", field: "firstName" };
      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug });
      } catch {
        return { status: "profile_error" };
      }
      if (access.status !== "authorized") return access;
      try {
        const updated = await repository().updateOwnProfile({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          userId: access.identity.userId,
          profile,
        });
        return updated ? { status: "updated", profile } : { status: "forbidden" };
      } catch {
        return { status: "profile_error" };
      }
    },
  };
}
