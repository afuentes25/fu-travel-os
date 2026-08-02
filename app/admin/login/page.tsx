import { unstable_noStore as noStore } from "next/cache";

import { safeAdminNext } from "../admin-utils";
import { AdminLoginForm } from "./login-form";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="admin-login-title">
        <div className={styles.kicker}>FU TRAVEL OS</div>
        <h1 id="admin-login-title">Acceso administrativo</h1>
        <p>Inicia sesión para administrar las reservaciones de tus agencias.</p>
        <AdminLoginForm next={next} />
      </section>
    </main>
  );
}
