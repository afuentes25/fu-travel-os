export type CustomerAgencyAccount = Readonly<{
  customerAccountId: string;
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}>;

export type CustomerAgencyAccountRecord = Readonly<{
  customerAccountId: string;
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  status: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}>;

export type CustomerIdentity = Readonly<{
  userId: string;
  email: string | null;
}>;

export type CustomerAgencyAccess =
  | Readonly<{
      status: "authorized";
      identity: CustomerIdentity;
      account: CustomerAgencyAccount;
      accounts: readonly CustomerAgencyAccount[];
    }>
  | Readonly<{
      status: "selection_required";
      accounts: readonly CustomerAgencyAccount[];
    }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "forbidden" }>;

export interface CustomerAgencyAccountRepositoryClient {
  listActiveByUserId(userId: string): Promise<readonly CustomerAgencyAccountRecord[]>;
}

export class CustomerAgencyAccessError extends Error {
  readonly name = "CustomerAgencyAccessError";

  constructor() {
    super("No fue posible resolver el acceso de cliente.");
  }
}

function activeAccounts(
  records: readonly CustomerAgencyAccountRecord[],
): readonly CustomerAgencyAccount[] {
  return records.flatMap((account) =>
    account.status === "active" &&
    account.customerAccountId &&
    account.agencyId &&
    account.agencySlug &&
    account.agencyName
      ? [{
        customerAccountId: account.customerAccountId,
        agencyId: account.agencyId,
        agencySlug: account.agencySlug,
        agencyName: account.agencyName,
        ...(account.firstName ? { firstName: account.firstName } : {}),
        ...(account.lastName ? { lastName: account.lastName } : {}),
        ...(account.phone ? { phone: account.phone } : {}),
        }]
      : [],
  );
}

/** Pure access orchestration; trusted identity and persistence are injected. */
export function createCustomerAgencyAccessResolver(dependencies: Readonly<{
  getIdentity: () => Promise<CustomerIdentity | null>;
  accountRepository: CustomerAgencyAccountRepositoryClient;
}>) {
  return {
    async resolve(
      input: Readonly<{ requestedAgencySlug?: string }> = {},
    ): Promise<CustomerAgencyAccess> {
      let identity: CustomerIdentity | null;
      try {
        identity = await dependencies.getIdentity();
      } catch {
        throw new CustomerAgencyAccessError();
      }
      if (!identity) return { status: "unauthenticated" };

      let accounts: readonly CustomerAgencyAccount[];
      try {
        accounts = activeAccounts(
          await dependencies.accountRepository.listActiveByUserId(identity.userId),
        );
      } catch {
        throw new CustomerAgencyAccessError();
      }

      const requestedAgencySlug = input.requestedAgencySlug?.trim();
      if (requestedAgencySlug) {
        const account = accounts.find(
          (candidate) => candidate.agencySlug === requestedAgencySlug,
        );
        return account
          ? { status: "authorized", identity, account, accounts }
          : { status: "forbidden" };
      }

      if (accounts.length === 0) return { status: "forbidden" };
      if (accounts.length === 1) {
        return { status: "authorized", identity, account: accounts[0], accounts };
      }
      return { status: "selection_required", accounts };
    },
  };
}
