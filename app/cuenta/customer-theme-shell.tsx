import "server-only";

import { headers } from "next/headers";
import type { ReactNode } from "react";

import type { CustomerAgencyAccount } from "@/lib/customers/customer-access";
import { resolveTenant, resolveTheme } from "@/lib/tenancy";

import { CustomerShell } from "./customer-shell";
import { CustomerThemeSurface } from "./customer-theme-chrome";

type CustomerThemeFrameProps = Readonly<{
  children: ReactNode;
  agencySlug?: string;
  requestedReturnTo?: string | null;
}>;

function returnToThemeContext(value?: string | null) {
  if (!value?.startsWith("/")) return { agencySlug: undefined, theme: undefined };
  const url = new URL(value, "https://customer.local");
  return {
    agencySlug: url.searchParams.get("tenant") ?? undefined,
    theme: url.searchParams.get("theme") ?? undefined,
  };
}

async function resolveCustomerTheme(input: Readonly<{
  agencySlug?: string;
  requestedReturnTo?: string | null;
}>) {
  const headerList = await headers();
  const returnTo = returnToThemeContext(input.requestedReturnTo);
  const agency = resolveTenant(
    headerList.get("host") ?? "localhost",
    input.agencySlug ?? returnTo.agencySlug,
  );
  return { agency, theme: resolveTheme(agency, input.agencySlug ? undefined : returnTo.theme) };
}

export async function CustomerThemeFrame({ children, agencySlug, requestedReturnTo }: CustomerThemeFrameProps) {
  const { agency, theme } = await resolveCustomerTheme({ agencySlug, requestedReturnTo });
  return <CustomerThemeSurface agency={agency} theme={theme}>{children}</CustomerThemeSurface>;
}

export async function CustomerThemeShell({
  children,
  account,
  accounts,
  agencySlug,
}: Readonly<{
  children: ReactNode;
  account?: CustomerAgencyAccount;
  accounts?: readonly CustomerAgencyAccount[];
  agencySlug?: string;
}>) {
  const { agency, theme } = await resolveCustomerTheme({ agencySlug: account?.agencySlug ?? agencySlug });
  return (
    <CustomerThemeSurface agency={agency} theme={theme} authenticated>
      <CustomerShell account={account} accounts={accounts}>{children}</CustomerShell>
    </CustomerThemeSurface>
  );
}
