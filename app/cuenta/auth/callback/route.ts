import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { getSupabasePublicEnvironment } from "@/lib/supabase/auth-env";
import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext } from "../../customer-utils";

function loginFallback(request: NextRequest, input: Readonly<{
  next: string;
  returnTo: string | null;
  claim: boolean;
}>) {
  const params = new URLSearchParams({ next: input.next });
  if (input.returnTo) params.set("returnTo", input.returnTo);
  if (input.claim) params.set("claim", "1");
  return new URL(`/cuenta/login?${params.toString()}`, request.url);
}

export async function GET(request: NextRequest) {
  const next = safeCustomerNext(request.nextUrl.searchParams.get("next")) ?? "/cuenta";
  const returnTo = safeCustomerAuthReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const claim = request.nextUrl.searchParams.get("claim") === "1" ? parseCustomerReservationClaimNext(next) : null;
  const response = NextResponse.redirect(new URL(returnTo ?? next, request.url));
  const { url, publishableKey } = getSupabasePublicEnvironment();
  const auth = createServerClient(url, publishableKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  const code = request.nextUrl.searchParams.get("code");
  const callbackInput = { next, returnTo, claim: Boolean(claim) };
  if (!code) return NextResponse.redirect(loginFallback(request, callbackInput));
  const { error } = await auth.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(loginFallback(request, callbackInput));
  if (claim) {
    const claimed = await claimReservationForAuthenticatedCustomer({ requestedAgencySlug: claim.agencySlug, reservationId: claim.reservationId }, auth);
    if (claimed.status === "claimed" || claimed.status === "existing") return NextResponse.redirect(new URL(`/cuenta/${encodeURIComponent(claim.agencySlug)}/reservaciones/${encodeURIComponent(claim.reservationId)}`, request.url), { headers: response.headers });
    return NextResponse.redirect(new URL(`/cuenta/login?next=${encodeURIComponent(next)}&claim=1`, request.url), { headers: response.headers });
  }
  return response;
}
