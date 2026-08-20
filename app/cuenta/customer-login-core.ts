import type { CustomerAgencyAccess } from "@/lib/customers/customer-access";

import type { CustomerLoginCredentials } from "./customer-utils";

export type CustomerLoginFlowResult =
  | Readonly<{ status: "auth_failed" }>
  | Readonly<{ status: "unexpected_error" }>
  | Readonly<{ status: "authorized"; access: Extract<CustomerAgencyAccess, { status: "authorized" }> }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>;

/**
 * Keeps authentication and customer authorization explicit and testable. The
 * redirect remains outside this flow so Next's redirect signal cannot be
 * mistaken for a login error.
 */
export async function runCustomerLoginFlow(dependencies: Readonly<{
  signInWithPassword: (credentials: CustomerLoginCredentials) => Promise<Readonly<{ error: unknown | null }>>;
  resolveAccess: () => Promise<CustomerAgencyAccess>;
}>, credentials: CustomerLoginCredentials): Promise<CustomerLoginFlowResult> {
  let signedIn: Readonly<{ error: unknown | null }>;
  try {
    signedIn = await dependencies.signInWithPassword(credentials);
  } catch {
    return { status: "unexpected_error" };
  }
  if (signedIn.error) return { status: "auth_failed" };

  try {
    const access = await dependencies.resolveAccess();
    if (access.status === "authorized") return { status: "authorized", access };
    if (access.status === "selection_required") return { status: "selection_required" };
    return { status: "forbidden" };
  } catch {
    return { status: "unexpected_error" };
  }
}
