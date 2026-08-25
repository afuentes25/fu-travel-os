"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { CustomerAgencyAccount } from "@/lib/customers/customer-access";

import { logoutCustomerAction } from "./actions";
import styles from "./cuenta.module.css";

type CustomerShellProps = Readonly<{
  children: React.ReactNode;
  account?: CustomerAgencyAccount;
  accounts?: readonly CustomerAgencyAccount[];
}>;

function CustomerNavigation({ account, onNavigate }: Readonly<{
  account?: CustomerAgencyAccount;
  onNavigate?: () => void;
}>) {
  const pathname = usePathname();
  const reservationsHref = account
    ? `/cuenta/${encodeURIComponent(account.agencySlug)}/reservaciones`
    : "/cuenta";
  return (
    <nav className={styles.customerSidebarNav} aria-label="Navegación de mi cuenta">
      <Link className={pathname === "/cuenta" ? styles.customerNavActive : ""} href="/cuenta" onClick={onNavigate}>Resumen</Link>
      <Link className={pathname.includes("/reservaciones") ? styles.customerNavActive : ""} href={reservationsHref} onClick={onNavigate}>Mis reservas</Link>
    </nav>
  );
}

function CustomerLogout() {
  return <form action={logoutCustomerAction} className={styles.customerLogout}><button type="submit">Cerrar sesión</button></form>;
}

export function CustomerShell({ children, account }: CustomerShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const brand = account?.agencyName ?? "Fu Travel OS";
  useEffect(() => {
    if (!drawerOpen) return;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuTrigger.current?.focus();
    };
  }, [drawerOpen]);
  return (
    <main className={styles.customerPortal}>
      <div className={styles.customerMobileBar} role="navigation" aria-label="Navegación de mi cuenta">
        <Link href="/cuenta" className={styles.customerMobileBrand} aria-label="Mi cuenta, Fu Travel OS"><span>{brand}</span><small>MI CUENTA</small></Link>
        <button ref={menuTrigger} type="button" className={styles.customerMenuButton} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} aria-controls="customer-navigation-drawer">Menú</button>
      </div>
      <aside className={styles.customerSidebar}>
        <Link href="/cuenta" className={styles.customerPortalBrand}><span>{brand}</span><small>MI CUENTA</small></Link>
        {account && <p className={styles.customerAgencyLabel}>{account.agencyName}</p>}
        <CustomerNavigation account={account} />
        <CustomerLogout />
      </aside>
      <div className={styles.customerPortalContent}>{children}</div>
      {drawerOpen && <div className={styles.customerDrawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setDrawerOpen(false)}><aside id="customer-navigation-drawer" className={styles.customerDrawer} role="dialog" aria-modal="true" aria-label="Menú de mi cuenta"><div className={styles.customerDrawerHeader}><span>Mi cuenta</span><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú">×</button></div><CustomerNavigation account={account} onNavigate={() => setDrawerOpen(false)} /><CustomerLogout /></aside></div>}
    </main>
  );
}
