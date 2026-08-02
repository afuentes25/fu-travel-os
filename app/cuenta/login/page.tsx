import { unstable_noStore as noStore } from "next/cache";

import styles from "../cuenta.module.css";
import { safeCustomerNext } from "../customer-utils";
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
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="customer-login-title">
        <div className={styles.kicker}>FU TRAVEL OS</div>
        <h1 id="customer-login-title">Acceso a tu cuenta</h1>
        <p>Inicia sesión para consultar las reservaciones vinculadas a tus agencias.</p>
        <CustomerLoginForm next={next} />
      </section>
    </main>
  );
}
