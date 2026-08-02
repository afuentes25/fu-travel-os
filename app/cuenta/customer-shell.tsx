import Link from "next/link";

import type { CustomerAgencyAccount } from "@/lib/customers/customer-access";

import { logoutCustomerAction } from "./actions";
import styles from "./cuenta.module.css";

export function CustomerShell({
  children,
  account,
  accounts,
}: Readonly<{
  children: React.ReactNode;
  account?: CustomerAgencyAccount;
  accounts?: readonly CustomerAgencyAccount[];
}>) {
  return (
    <main className={styles.customerPageShell}>
      <header className={styles.customerTopbar}>
        <Link href="/cuenta" className={styles.customerBrand} aria-label="Fu Travel OS, mi cuenta">
          FU TRAVEL OS <small>MI CUENTA</small>
        </Link>
        {account && (
          <div className={styles.customerAgencyContext}>
            <strong>{account.agencyName}</strong>
          </div>
        )}
        <div className={styles.customerTopbarActions}>
          {accounts && accounts.length > 1 && <Link href="/cuenta">Cambiar de agencia</Link>}
          <form action={logoutCustomerAction}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </header>
      {children}
    </main>
  );
}
