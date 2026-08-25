import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { listCustomerReservations, type CustomerReservationSummary } from "@/lib/customers/customer-reservations";

import { CustomerShell } from "./customer-shell";
import { customerReservationStatusLabel } from "./customer-reservation-utils";
import styles from "./cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateLabel(value: string | null) {
  if (!value) return "Fecha por confirmar";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha por confirmar" : date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function money(value: number | null, currency: string) {
  if (value === null) return null;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function nextReservation(items: readonly CustomerReservationSummary[]) {
  const now = Date.now();
  const upcoming = items
    .filter((item) => item.trip.departureDate && !Number.isNaN(new Date(item.trip.departureDate).getTime()) && new Date(item.trip.departureDate).getTime() >= now)
    .sort((left, right) => new Date(left.trip.departureDate!).getTime() - new Date(right.trip.departureDate!).getTime());
  return upcoming[0] ?? items[0] ?? null;
}

export default async function CustomerPage() {
  noStore();
  let access: Awaited<ReturnType<typeof resolveCustomerAgencyAccess>>;
  try {
    access = await resolveCustomerAgencyAccess();
  } catch {
    return <CustomerShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar tu cuenta</h1><p>Intenta nuevamente en unos momentos.</p></section></CustomerShell>;
  }
  if (access.status === "unauthenticated") redirect("/cuenta/login");
  if (access.status === "forbidden") {
    return <CustomerShell><section className={styles.stateCard}><h1>Tu cuenta está lista</h1><p>Aún no tienes reservaciones vinculadas. Explora los próximos viajes para comenzar.</p><Link className={styles.reservationLink} href="/viajes">Explorar viajes</Link></section></CustomerShell>;
  }
  if (access.status === "selection_required") {
    return <CustomerShell accounts={access.accounts}><section className={styles.content} aria-labelledby="customer-agencies-title"><div className={styles.heading}><div><span className={styles.kicker}>MI CUENTA</span><h1 id="customer-agencies-title">Elige una agencia</h1></div><p>Accede únicamente a las reservaciones vinculadas a tu cuenta de cliente.</p></div><div className={styles.agencyGrid}>{access.accounts.map((account) => <Link className={styles.agencyCard} key={account.agencySlug} href={`/cuenta/${encodeURIComponent(account.agencySlug)}/reservaciones`}><strong>{account.agencyName}</strong><span>Ver mis reservaciones</span></Link>)}</div></section></CustomerShell>;
  }

  let listing: Awaited<ReturnType<typeof listCustomerReservations>> | null = null;
  try {
    listing = await listCustomerReservations({ requestedAgencySlug: access.account.agencySlug, limit: 20 });
  } catch {
    listing = null;
  }
  const reservations = listing?.status === "authorized" ? listing.items : [];
  const featured = nextReservation(reservations);
  const reservationHref = `/cuenta/${encodeURIComponent(access.account.agencySlug)}/reservaciones`;
  return (
    <CustomerShell account={access.account}>
      <section className={`${styles.content} ${styles.customerDashboard}`} aria-labelledby="customer-dashboard-title">
        <header className={styles.customerDashboardHero}>
          <div><span className={styles.kicker}>MI CUENTA</span><h1 id="customer-dashboard-title">Tus próximos viajes, en un solo lugar.</h1></div>
          <p>Consulta el estado de tus reservaciones y continúa con los datos de viajeros, pagos y documentos cuando estén disponibles.</p>
        </header>
        {featured ? (
          <div className={styles.customerDashboardGrid}>
            <article className={styles.customerDashboardCard} aria-label="Próxima reservación">
              <span className={styles.kicker}>PRÓXIMA RESERVACIÓN</span>
              <h2>{featured.trip.name ?? "Viaje por confirmar"}</h2>
              <p>{dateLabel(featured.trip.departureDate)} · {featured.reservationCode}</p>
              <div className={styles.customerDashboardFacts}>
                <span>{customerReservationStatusLabel(featured.status)}</span>
                <span>{featured.occupancy.totalTravelers ?? "—"} viajeros</span>
                {money(featured.amounts.remainingAmount, featured.amounts.currency) && <span>Saldo: {money(featured.amounts.remainingAmount, featured.amounts.currency)}</span>}
              </div>
              <div className={styles.customerDashboardActions}><Link href={`${reservationHref}/${encodeURIComponent(featured.id)}`}>Ver reservación</Link><Link href={reservationHref}>Ver todas</Link></div>
            </article>
            <aside className={styles.customerDashboardCard}><span className={styles.kicker}>MIS RESERVAS</span><h2>{reservations.length}</h2><p>{reservations.length === 1 ? "Reservación vinculada a tu cuenta." : "Reservaciones vinculadas a tu cuenta."}</p><div className={styles.customerDashboardActions}><Link href={reservationHref}>Ver mis reservas</Link></div></aside>
          </div>
        ) : (
          <section className={styles.customerDashboardEmpty}><span className={styles.kicker}>TU PRÓXIMA AVENTURA</span><h2>Aún no tienes reservaciones.</h2><p>Explora nuestros próximos viajes y encuentra tu siguiente destino.</p><Link href={`/viajes?tenant=${encodeURIComponent(access.account.agencySlug)}`}>Explorar viajes</Link></section>
        )}
      </section>
    </CustomerShell>
  );
}
