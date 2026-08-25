import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { CustomerShell } from "../customer-shell";
import { parseCustomerReservationClaimNext, safeCustomerNext } from "../customer-utils";
import styles from "../cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LinkReservationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  noStore();
  const params = await searchParams;
  const next = safeCustomerNext(params.next);
  const target = parseCustomerReservationClaimNext(next);
  if (!target || !next) redirect("/cuenta");

  const auth = await createSupabaseAuthServerClient();
  const result = await claimReservationForAuthenticatedCustomer({
    requestedAgencySlug: target.agencySlug,
    reservationId: target.reservationId,
  }, auth);
  if (result.status === "claimed" || result.status === "existing") redirect(next);
  if (result.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(next)}&claim=1`);
  }

  const message = result.status === "email_mismatch"
    ? "El correo de tu cuenta no coincide con el utilizado en esta reservación."
    : result.status === "reservation_already_claimed"
      ? "Esta reservación ya está vinculada a otra cuenta."
      : "No fue posible vincular la reservación en este momento. Inténtalo nuevamente.";
  return (
    <CustomerShell>
      <section className={styles.stateCard} role="alert">
        <span className={styles.kicker}>MI CUENTA</span>
        <h1>No pudimos vincular la reservación</h1>
        <p>{message}</p>
      </section>
    </CustomerShell>
  );
}
