import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { createAdminReservationRepository } from "@/lib/reservations/admin-repository";
import type { AdminReservationListItem } from "@/lib/reservations/admin-listing";

import { AdminShell } from "../../admin-shell";
import {
  ADMIN_RESERVATION_STATUSES,
  adminReservationHref,
  adminReservationStatusLabel,
  adminRoleLabel,
  parseAdminReservationPage,
  parseAdminReservationStatus,
} from "../../admin-utils";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Fecha no disponible"
    : parsed.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function ReservationCells({ reservation }: { reservation: AdminReservationListItem }) {
  return (
    <>
      <td><strong>{reservation.reservationCode}</strong><span className={styles.status}>{adminReservationStatusLabel(reservation.status)}</span></td>
      <td><strong>{reservation.tripName}</strong><small>{reservation.tripCode}</small></td>
      <td>{date(reservation.departureDate)}<small>Creada: {date(reservation.createdAt)}</small></td>
      <td>{reservation.boardingPointName}</td>
      <td>{reservation.rooms}</td>
      <td>{reservation.occupancy.adults}</td>
      <td>{reservation.occupancy.minors}</td>
      <td>{reservation.occupancy.totalTravelers}</td>
      <td><strong>{money(reservation.total, reservation.currency)}</strong><small>{reservation.currency}</small></td>
      <td>{money(reservation.depositAmount, reservation.currency)}<small>Saldo: {money(reservation.remainingAmount, reservation.currency)}</small></td>
    </>
  );
}

function ReservationCard({ reservation }: { reservation: AdminReservationListItem }) {
  return (
    <article className={styles.reservationCard}>
      <div><span>Folio</span><strong>{reservation.reservationCode}</strong><em>{adminReservationStatusLabel(reservation.status)}</em></div>
      <div><span>Tour</span><strong>{reservation.tripName}</strong><small>{reservation.tripCode}</small></div>
      <div><span>Salida</span><strong>{date(reservation.departureDate)}</strong><small>Creada: {date(reservation.createdAt)}</small></div>
      <div><span>Abordaje</span><strong>{reservation.boardingPointName}</strong></div>
      <div><span>Viajeros</span><strong>{reservation.occupancy.totalTravelers}</strong><small>{reservation.occupancy.adults} adultos · {reservation.occupancy.minors} menores · {reservation.rooms} habitaciones</small></div>
      <div><span>Total</span><strong>{money(reservation.total, reservation.currency)}</strong><small>Anticipo: {money(reservation.depositAmount, reservation.currency)} · Saldo: {money(reservation.remainingAmount, reservation.currency)}</small></div>
    </article>
  );
}

export default async function AdminReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const [{ agencySlug }, query] = await Promise.all([params, searchParams]);
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try {
    access = await resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug });
  } catch {
    return (
      <AdminShell>
        <section className={styles.stateCard} role="alert">
          <h1>No fue posible cargar las reservaciones</h1>
          <p>Intenta nuevamente en unos momentos.</p>
        </section>
      </AdminShell>
    );
  }
  if (access.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/reservaciones`)}`);
  if (access.status === "selection_required") redirect("/admin");
  if (access.status === "forbidden") {
    return (
      <AdminShell>
        <section className={styles.stateCard}>
          <h1>Acceso no autorizado</h1>
          <p>No tienes permiso para administrar esta sección.</p>
        </section>
      </AdminShell>
    );
  }

  const status = parseAdminReservationStatus(query.status);
  const page = parseAdminReservationPage(query.page);
  const reservations = await createAdminReservationRepository().list({
    agencySlug: access.agency.agencySlug,
    ...(status ? { status } : {}),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const previousHref = page > 1 ? adminReservationHref(access.agency.agencySlug, status, page - 1) : null;
  const nextHref = reservations.length === PAGE_SIZE
    ? adminReservationHref(access.agency.agencySlug, status, page + 1)
    : null;

  return (
    <AdminShell agency={access.agency} memberships={access.memberships}>
      <section className={styles.content} aria-labelledby="admin-reservations-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>{access.agency.agencyName}</span>
            <h1 id="admin-reservations-title">Reservaciones</h1>
            <p>{adminRoleLabel(access.agency.role)}</p>
          </div>
          <div className={styles.summary}>
            <span><b>{reservations.length}</b> resultados</span>
            <span>Página <b>{page}</b></span>
            <span>{status ? `Filtro: ${adminReservationStatusLabel(status)}` : "Sin filtro activo"}</span>
          </div>
        </div>

        <nav className={styles.filters} aria-label="Filtros de reservaciones">
          <Link href={adminReservationHref(access.agency.agencySlug, undefined, 1)} className={!status ? styles.filterActive : ""}>Todas</Link>
          {ADMIN_RESERVATION_STATUSES.map((value) => (
            <Link
              className={status === value ? styles.filterActive : ""}
              href={adminReservationHref(access.agency.agencySlug, value, 1)}
              key={value}
            >
              {adminReservationStatusLabel(value)}
            </Link>
          ))}
        </nav>

        {reservations.length === 0 ? (
          <section className={styles.emptyState}>
            <h2>No hay reservaciones para mostrar</h2>
            <p>El filtro actual no devolvió resultados.</p>
          </section>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.reservationTable}>
                <caption className="sr-only">Listado de reservaciones de {access.agency.agencyName}</caption>
                <thead><tr><th>Folio y estado</th><th>Tour</th><th>Fechas</th><th>Abordaje</th><th>Hab.</th><th>Adultos</th><th>Menores</th><th>Total viajeros</th><th>Total</th><th>Anticipo y saldo</th></tr></thead>
                <tbody>{reservations.map((reservation) => <tr key={reservation.id}><ReservationCells reservation={reservation} /></tr>)}</tbody>
              </table>
            </div>
            <div className={styles.mobileCards}>{reservations.map((reservation) => <ReservationCard reservation={reservation} key={reservation.id} />)}</div>
          </>
        )}
        <nav className={styles.pagination} aria-label="Paginación de reservaciones">
          {previousHref ? <Link href={previousHref}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}
          <span>Página {page}</span>
          {nextHref ? <Link href={nextHref}>Siguiente</Link> : <span aria-disabled="true">Siguiente</span>}
        </nav>
      </section>
    </AdminShell>
  );
}
