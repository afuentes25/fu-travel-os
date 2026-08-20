import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import {
  CustomerReservationDetailError,
  getCustomerReservationDetail,
} from "@/lib/customers/customer-reservation-detail";

import { CustomerShell } from "../../../customer-shell";
import {
  customerReservationDetailNextStep,
  customerReservationStatusLabel,
} from "../../../customer-reservation-utils";
import styles from "../../../cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        month: "long",
        year: "numeric",
      });
}

export default async function CustomerReservationDetailPage({
  params,
}: Readonly<{ params: Promise<{ agencySlug: string; reservationId: string }> }>) {
  noStore();
  const { agencySlug, reservationId } = await params;
  let detail: Awaited<ReturnType<typeof getCustomerReservationDetail>>;
  try {
    detail = await getCustomerReservationDetail({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch (error) {
    const unavailable = error instanceof CustomerReservationDetailError;
    return (
      <CustomerShell>
        <section className={styles.stateCard} role="alert">
          <h1>{unavailable ? "Reservación no disponible" : "No fue posible cargar la reservación"}</h1>
          <p>{unavailable ? "No encontramos una reservación disponible para tu cuenta." : "Intenta nuevamente en unos momentos."}</p>
        </section>
      </CustomerShell>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (detail.status === "selection_required") redirect("/cuenta");
  if (detail.status === "forbidden" || detail.status === "not_found") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
          <Link className={styles.reservationLink} href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones`}>Volver a Mis reservaciones</Link>
        </section>
      </CustomerShell>
    );
  }

  const { reservation } = detail;
  const pendingTravelerData = reservation.travelerDataStatus === "pending";
  return (
    <CustomerShell account={detail.account}>
      <section className={styles.content} aria-labelledby="customer-reservation-title">
        <Link className={styles.backLink} href={`/cuenta/${encodeURIComponent(detail.account.agencySlug)}/reservaciones`}>← Volver a Mis reservaciones</Link>
        <header className={styles.detailHeading}>
          <div>
            <span className={styles.kicker}>Mi reservación</span>
            <h1 id="customer-reservation-title">{reservation.reservationCode}</h1>
            <span className={styles.status}>{customerReservationStatusLabel(reservation.status)}</span>
          </div>
          <p>Creada: {date(reservation.createdAt)}</p>
        </header>

        <aside className={styles.nextStep} aria-label="Próximo paso">
          <strong>Próximo paso</strong>
          <p>{customerReservationDetailNextStep(reservation.status)}</p>
        </aside>

        <div className={styles.detailGrid}>
          <section className={styles.detailCard} aria-labelledby="customer-trip-title"><h2 id="customer-trip-title">Resumen del viaje</h2><dl><div><dt>Tour</dt><dd>{valueOrUnavailable(reservation.trip.name)}</dd></div><div><dt>Clave</dt><dd>{valueOrUnavailable(reservation.trip.code)}</dd></div><div><dt>Fecha de salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div><div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div></dl></section>
          <section className={styles.detailCard} aria-labelledby="customer-occupancy-title"><h2 id="customer-occupancy-title">Ocupación</h2><dl><div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div><div><dt>Adultos</dt><dd>{valueOrUnavailable(reservation.occupancy.adults)}</dd></div><div><dt>Menores</dt><dd>{valueOrUnavailable(reservation.occupancy.minors)}</dd></div><div><dt>Total viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div></dl></section>
          <section className={styles.detailCard} aria-labelledby="customer-finance-title"><h2 id="customer-finance-title">Estado financiero</h2><dl><div><dt>Moneda</dt><dd>{reservation.amounts.currency}</dd></div><div><dt>Total</dt><dd>{money(reservation.amounts.total, reservation.amounts.currency)}</dd></div><div><dt>Anticipo {reservation.amounts.depositPercent === null ? "" : `(${reservation.amounts.depositPercent}%)`}</dt><dd>{money(reservation.amounts.depositAmount, reservation.amounts.currency)}</dd></div><div><dt>Saldo restante</dt><dd>{money(reservation.amounts.remainingAmount, reservation.amounts.currency)}</dd></div></dl></section>
          <section className={styles.detailCard} aria-labelledby="customer-contact-title"><h2 id="customer-contact-title">Contacto principal</h2>{reservation.primaryContact ? <dl><div><dt>Nombre</dt><dd>{valueOrUnavailable(reservation.primaryContact.fullName)}</dd></div><div><dt>Correo</dt><dd>{valueOrUnavailable(reservation.primaryContact.email)}</dd></div><div><dt>Teléfono</dt><dd>{valueOrUnavailable(reservation.primaryContact.phone)}</dd></div></dl> : <p className={styles.unavailable}>No disponible</p>}</section>
        </div>

        <section className={styles.detailCard} aria-labelledby="customer-travelers-title">
          <div className={styles.detailCardHeader}><h2 id="customer-travelers-title">Viajeros</h2>{pendingTravelerData && <p role="status">Datos de viajeros pendientes de completar</p>}</div>
          {reservation.travelers.length ? <div className={styles.travelersTableWrap}><table className={styles.travelersTable}><thead><tr><th>Categoría</th><th>Nombre</th><th>Edad</th><th>Estado</th></tr></thead><tbody>{reservation.travelers.map((traveler, index) => <tr key={`${traveler.category ?? "viajero"}-${index}`}><td>{valueOrUnavailable(traveler.category)}</td><td>{valueOrUnavailable(traveler.fullName)}</td><td>{valueOrUnavailable(traveler.age)}</td><td>{valueOrUnavailable(traveler.status)}</td></tr>)}</tbody></table></div> : <p className={styles.unavailable}>Aún no se han registrado los datos de los viajeros.</p>}
        </section>
      </section>
    </CustomerShell>
  );
}
