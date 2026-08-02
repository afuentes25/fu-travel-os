import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import { AdminShell } from "./admin-shell";
import { adminRoleLabel } from "./admin-utils";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  noStore();
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try {
    access = await resolveAdminAgencyAccess();
  } catch {
    return (
      <AdminShell>
        <section className={styles.stateCard} role="alert">
          <h1>No fue posible cargar la administración</h1>
          <p>Intenta nuevamente en unos momentos.</p>
        </section>
      </AdminShell>
    );
  }
  if (access.status === "unauthenticated") redirect("/admin/login");
  if (access.status === "authorized") {
    redirect(`/admin/${encodeURIComponent(access.agency.agencySlug)}/reservaciones`);
  }

  if (access.status === "forbidden") {
    return (
      <AdminShell>
        <section className={styles.stateCard}>
          <h1>Sin acceso administrativo</h1>
          <p>Tu cuenta no tiene una membresía administrativa activa.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell memberships={access.memberships}>
      <section className={styles.content} aria-labelledby="admin-agencies-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>ADMINISTRACIÓN</span>
            <h1 id="admin-agencies-title">Elige una agencia</h1>
          </div>
          <p>Tu acceso se limita a las agencias donde tienes una membresía activa.</p>
        </div>
        <div className={styles.agencyGrid}>
          {access.memberships.map((agency) => (
            <Link
              className={styles.agencyCard}
              key={agency.agencyId}
              href={`/admin/${encodeURIComponent(agency.agencySlug)}/reservaciones`}
            >
              <strong>{agency.agencyName}</strong>
              <span>{agency.agencySlug}</span>
              <small>{adminRoleLabel(agency.role)}</small>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
