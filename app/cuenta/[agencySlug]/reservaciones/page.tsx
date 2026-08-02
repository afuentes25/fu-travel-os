import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import { CustomerShell } from "../../customer-shell";
import styles from "../../cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerReservationsShellPage({
  params,
}: Readonly<{ params: Promise<{ agencySlug: string }> }>) {
  noStore();
  const { agencySlug } = await params;
  let access: Awaited<ReturnType<typeof resolveCustomerAgencyAccess>>;
  try {
    access = await resolveCustomerAgencyAccess({ requestedAgencySlug: agencySlug });
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

  if (access.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones`)}`);
  }
  if (access.status === "selection_required") redirect("/cuenta");
  if (access.status === "forbidden") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Acceso no autorizado</h1>
          <p>No tienes acceso a esta área de reservaciones.</p>
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell account={access.account} accounts={access.accounts}>
      <section className={styles.content} aria-labelledby="customer-reservations-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>{access.account.agencyName}</span>
            <h1 id="customer-reservations-title">Mis reservaciones</h1>
          </div>
        </div>
        <section className={styles.placeholderCard}>
          <p>Tus reservaciones vinculadas aparecerán aquí</p>
        </section>
      </section>
    </CustomerShell>
  );
}
