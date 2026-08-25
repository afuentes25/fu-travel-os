import { unstable_noStore as noStore } from "next/cache";

import styles from "../cuenta.module.css";
import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext } from "../customer-utils";
import { CustomerLoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerLoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  noStore();
  const params = await searchParams;
  const next = safeCustomerNext(params.next);
  const returnTo = safeCustomerAuthReturnTo(params.returnTo);
  const claim = params.claim === "1" && Boolean(parseCustomerReservationClaimNext(next));
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="customer-login-title">
        <div className={styles.kicker}>FU TRAVEL OS · MI CUENTA</div>
        <h1 id="customer-login-title">Inicia sesión</h1>
        <p>Consulta y administra tus reservaciones, pagos, viajeros y documentos.</p>
        {returnTo && <p className={styles.authContext}>Después de iniciar sesión volverás a tu reservación.</p>}
        {claim && <p className={styles.authContext}>Después de iniciar sesión volverás a tu reservación.</p>}
        <CustomerLoginForm next={next} returnTo={returnTo} claim={claim} />
      </section>
    </main>
  );
}
