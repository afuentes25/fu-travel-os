import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import { CustomerShell } from "./customer-shell";
import styles from "./cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerPage() {
  noStore();
  let access: Awaited<ReturnType<typeof resolveCustomerAgencyAccess>>;
  try {
    access = await resolveCustomerAgencyAccess();
  } catch {
    return (
      <CustomerShell>
        <section className={styles.stateCard} role="alert">
          <h1>No fue posible cargar tu cuenta</h1>
          <p>Intenta nuevamente en unos momentos.</p>
        </section>
      </CustomerShell>
    );
  }

  if (access.status === "unauthenticated") redirect("/cuenta/login");
  if (access.status === "authorized") {
    redirect(`/cuenta/${encodeURIComponent(access.account.agencySlug)}/reservaciones`);
  }
  if (access.status === "forbidden") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>No tienes acceso activo como cliente</h1>
          <p>Tu cuenta no tiene una cuenta de cliente activa asociada a una agencia.</p>
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell accounts={access.accounts}>
      <section className={styles.content} aria-labelledby="customer-agencies-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>MI CUENTA</span>
            <h1 id="customer-agencies-title">Elige una agencia</h1>
          </div>
          <p>Accede únicamente a las reservaciones vinculadas a tu cuenta de cliente.</p>
        </div>
        <div className={styles.agencyGrid}>
          {access.accounts.map((account) => (
            <Link
              className={styles.agencyCard}
              key={account.agencySlug}
              href={`/cuenta/${encodeURIComponent(account.agencySlug)}/reservaciones`}
            >
              <strong>{account.agencyName}</strong>
              <span>{account.agencySlug}</span>
            </Link>
          ))}
        </div>
      </section>
    </CustomerShell>
  );
}
