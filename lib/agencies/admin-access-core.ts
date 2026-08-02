export type AdminAgencyRole = "owner" | "admin" | "staff";
export type AdminMembershipStatus = "active" | "invited" | "suspended";

export type AdminAgencyMembership = Readonly<{
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  role: AdminAgencyRole;
}>;

export type AdminAgencyMembershipRecord = Readonly<{
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  role: string;
  status: string;
}>;

export type AdminIdentity = Readonly<{
  userId: string;
  email: string | null;
}>;

export type AdminAgencyAccess =
  | Readonly<{
      status: "authorized";
      identity: AdminIdentity;
      agency: AdminAgencyMembership;
      memberships: readonly AdminAgencyMembership[];
    }>
  | Readonly<{
      status: "selection_required";
      memberships: readonly AdminAgencyMembership[];
    }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "forbidden" }>;

export interface AdminAgencyMembershipRepositoryClient {
  listByUserId(userId: string): Promise<readonly AdminAgencyMembershipRecord[]>;
}

export class AdminAgencyAccessError extends Error {
  readonly name = "AdminAgencyAccessError";

  constructor() {
    super("No fue posible resolver el acceso administrativo.");
  }
}

const ADMIN_ROLES: readonly AdminAgencyRole[] = ["owner", "admin", "staff"];

function isAdminRole(role: string): role is AdminAgencyRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

function activeMemberships(
  records: readonly AdminAgencyMembershipRecord[],
): readonly AdminAgencyMembership[] {
  return records.flatMap((membership) =>
    membership.status === "active" && isAdminRole(membership.role)
      ? [
          {
            agencyId: membership.agencyId,
            agencySlug: membership.agencySlug,
            agencyName: membership.agencyName,
            role: membership.role,
          },
        ]
      : [],
  );
}

/** Pure authorization orchestration; identity and persistence are injected. */
export function createAdminAgencyAccessResolver(dependencies: Readonly<{
  getIdentity: () => Promise<AdminIdentity | null>;
  membershipRepository: AdminAgencyMembershipRepositoryClient;
}>) {
  return {
    async resolve(input: Readonly<{ requestedAgencySlug?: string }> = {}): Promise<AdminAgencyAccess> {
      let identity: AdminIdentity | null;
      try {
        identity = await dependencies.getIdentity();
      } catch {
        throw new AdminAgencyAccessError();
      }
      if (!identity) return { status: "unauthenticated" };

      let memberships: readonly AdminAgencyMembership[];
      try {
        memberships = activeMemberships(
          await dependencies.membershipRepository.listByUserId(identity.userId),
        );
      } catch {
        throw new AdminAgencyAccessError();
      }

      const requestedAgencySlug = input.requestedAgencySlug?.trim();
      if (requestedAgencySlug) {
        const agency = memberships.find(
          (membership) => membership.agencySlug === requestedAgencySlug,
        );
        return agency
          ? { status: "authorized", identity, agency, memberships }
          : { status: "forbidden" };
      }

      if (memberships.length === 0) return { status: "forbidden" };
      if (memberships.length === 1) {
        return {
          status: "authorized",
          identity,
          agency: memberships[0],
          memberships,
        };
      }
      return { status: "selection_required", memberships };
    },
  };
}
