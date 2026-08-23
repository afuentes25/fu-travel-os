import Link from "next/link";

import type { AdminAgencyMembership } from "@/lib/agencies/admin-access";

import { logoutAdminAction } from "./actions";
import { adminRoleLabel } from "./admin-utils";
import styles from "./admin.module.css";

export function AdminShell({
  children,
  agency,
  memberships,
}: {
  children: React.ReactNode;
  agency?: AdminAgencyMembership;
  memberships?: readonly AdminAgencyMembership[];
}) {
  return (
    <main className={styles.adminPageShell}>
      <header className={styles.adminTopbar}>
        <Link href="/admin" className={styles.adminBrand} aria-label="Fu Travel OS administración">
          FU TRAVEL OS <small>ADMINISTRACIÓN</small>
        </Link>
        {agency && (
          <div className={styles.adminAgencyContext}>
            <strong>{agency.agencyName}</strong>
            <span>{adminRoleLabel(agency.role)}</span>
          </div>
        )}
        <div className={styles.adminTopbarActions}>
          {agency && <Link href={`/admin/${encodeURIComponent(agency.agencySlug)}/salidas`}>Salidas</Link>}
          {memberships && memberships.length > 1 && <Link href="/admin">Cambiar agencia</Link>}
          <form action={logoutAdminAction}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}
