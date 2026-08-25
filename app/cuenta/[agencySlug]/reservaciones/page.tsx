import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import {
  CUSTOMER_RESERVATION_STATUSES,
  listCustomerReservations,
  normalizeCustomerReservationStatus,
  type CustomerReservationSummary,
} from "@/lib/customers/customer-reservations";

import { CustomerThemeShell } from "../../customer-theme-shell";
import {
  customerReservationHref,
  customerReservationNextStep,
  customerReservationStatusLabel,
  parseCustomerReservationPage,
} from "../../customer-reservation-utils";
import styles from "../../cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

function valueOrUnavailable(value: number | string | null) {
  return value ?? "No disponible";
}

function money(value: number | null, currency: string) {
  if (value === null) return "No disponible";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value: string | null) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "No disponible"
    : parsed.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function ReservationCard({
  reservation,
  agencySlug,
}: Readonly<{ reservation: CustomerReservationSummary; agencySlug: string }>) {
  const pendingTravelerData = reservation.travelerDataStatus === "pending";
  return (
    <article className={styles.reservationCard}>
      <div className={styles.reservationCardHeader}>
        <div>
          <span className={styles.reservationLabel}>Folio</span>
          <strong>{reservation.reservationCode}</strong>
        </div>
        <span className={styles.status}>{customerReservationStatusLabel(reservation.status)}</span>
      </div>
      <dl className={styles.reservationDetails}>
        <div><dt>Tour</dt><dd>{valueOrUnavailable(reservation.trip.name)}</dd></div>
        <div><dt>Clave del Tour</dt><dd>{valueOrUnavailable(reservation.trip.code)}</dd></div>
        <div><dt>Salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div>
        <div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div>
        <div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div>
        <div><dt>Adultos</dt><dd>{valueOrUnavailable(reservation.occupancy.adults)}</dd></div>
        <div><dt>Menores</dt><dd>{valueOrUnavailable(reservation.occupancy.minors)}</dd></div>
        <div><dt>Total viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div>
        <div><dt>Total</dt><dd>{money(reservation.amounts.total, reservation.amounts.currency)}</dd></div>
        <div><dt>Anticipo</dt><dd>{reservation.amounts.depositPercent === null ? "No disponible" : `${reservation.amounts.depositPercent}% · ${money(reservation.amounts.depositAmount, reservation.amounts.currency)}`}</dd></div>
        <div><dt>Saldo</dt><dd>{money(reservation.amounts.remainingAmount, reservation.amounts.currency)}</dd></div>
        <div><dt>Moneda</dt><dd>{reservation.amounts.currency}</dd></div>
      </dl>
      <div className={styles.reservationMeta}>
        <span>Datos de viajeros: {reservation.travelerDataStatus === null ? "No disponible" : reservation.travelerDataStatus === "pending" ? "Pendientes" : "Completos"}</span>
        {pendingTravelerData && <p>Datos de viajeros pendientes de completar.</p>}
      </div>
      <aside className={styles.nextStep} aria-label="Próximo paso">
        <strong>Próximo paso</strong>
        <p>{customerReservationNextStep(reservation.status)}</p>
      </aside>
      <Link
        className={styles.reservationLink}
        href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones/${encodeURIComponent(reservation.id)}`}
      >
        Ver reservación
      </Link>
    </article>
  );
}

export default async function CustomerReservationsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ agencySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  noStore();
  const [{ agencySlug }, query] = await Promise.all([params, searchParams]);
  const status = normalizeCustomerReservationStatus(
    typeof query.status === "string" ? query.status : undefined,
  );
  const page = parseCustomerReservationPage(query.page);

  let reservations: Awaited<ReturnType<typeof listCustomerReservations>>;
  try {
    reservations = await listCustomerReservations({
      requestedAgencySlug: agencySlug,
      ...(status ? { status } : {}),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard} role="alert">
          <h1>No fue posible cargar tus reservaciones</h1>
          <p>Intenta nuevamente en unos momentos.</p>
        </section>
      </CustomerThemeShell>
    );
  }

  if (reservations.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones`)}`);
  }
  if (reservations.status === "selection_required") redirect("/cuenta");
  if (reservations.status === "forbidden") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Acceso no autorizado</h1>
          <p>No tienes acceso a esta área de reservaciones.</p>
        </section>
      </CustomerThemeShell>
    );
  }

  const previousHref = page > 1
    ? customerReservationHref(reservations.account.agencySlug, status, page - 1)
    : null;
  const nextHref = reservations.offset + reservations.items.length < reservations.total
    ? customerReservationHref(reservations.account.agencySlug, status, page + 1)
    : null;

  return (
    <CustomerThemeShell account={reservations.account}>
      <section className={styles.content} aria-labelledby="customer-reservations-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>{reservations.account.agencyName}</span>
            <h1 id="customer-reservations-title">Mis reservaciones</h1>
          </div>
          <div className={styles.reservationSummary}>
            <span><b>{reservations.total}</b> reservaciones</span>
            <span>Página <b>{page}</b></span>
          </div>
        </div>

        <nav className={styles.filters} aria-label="Filtrar mis reservaciones">
          <Link href={customerReservationHref(reservations.account.agencySlug, undefined, 1)} className={!status ? styles.filterActive : ""}>Todas</Link>
          {CUSTOMER_RESERVATION_STATUSES.map((value) => (
            <Link
              className={status === value ? styles.filterActive : ""}
              href={customerReservationHref(reservations.account.agencySlug, value, 1)}
              key={value}
            >
              {customerReservationStatusLabel(value)}
            </Link>
          ))}
        </nav>

        {reservations.items.length === 0 ? (
          <section className={styles.emptyState}>
            <h2>Aún no tienes reservaciones vinculadas.</h2>
            <p>Si realizaste una reservación recientemente, contacta a la agencia para que la vincule con tu cuenta.</p>
          </section>
        ) : (
          <div className={styles.reservationGrid}>
            {reservations.items.map((reservation) => (
              <ReservationCard
                agencySlug={reservations.account.agencySlug}
                key={reservation.id}
                reservation={reservation}
              />
            ))}
          </div>
        )}

        <nav className={styles.pagination} aria-label="Paginación de mis reservaciones">
          {previousHref ? <Link href={previousHref}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}
          <span>Página {page}</span>
          {nextHref ? <Link href={nextHref}>Siguiente</Link> : <span aria-disabled="true">Siguiente</span>}
        </nav>
      </section>
    </CustomerThemeShell>
  );
}
