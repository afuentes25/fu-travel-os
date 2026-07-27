"use client";

import { useMemo, useState } from "react";
import { getStickyTripSections } from "@/lib/trip-sections";
import type { LavellaTripDetailProps } from "./lavella-types";
import styles from "./lavella-detail.module.css";
import { LavellaBookingPanel } from "./lavella-booking-panel";
import { LavellaTourCard } from "./lavella-tour-card";
import { LavellaTripGallery } from "./lavella-trip-gallery";
import { LavellaTripHero } from "./lavella-trip-hero";
import { LavellaTripNavigation } from "./lavella-trip-navigation";
import { LavellaTripSections } from "./lavella-trip-sections";
import { lavellaDeparture } from "./lavella-utils";

export function LavellaTripDetail({ agency, trip, related, onNavigate }: LavellaTripDetailProps) {
  const firstDeparture = useMemo(() => lavellaDeparture(trip), [trip]);
  const [departureId, setDepartureId] = useState(firstDeparture.id);
  const sections = getStickyTripSections(trip);
  return (
    <main className={styles.detail}>
      <LavellaTripHero trip={trip} departureId={departureId} onBack={() => onNavigate("/viajes")} onReserve={() => document.getElementById("reserva")?.scrollIntoView({ behavior: "smooth" })} />
      <section className={styles.galleryStage}>
        <div className={styles.galleryHeading}>
          <span>GALERÍA</span>
          <p>Desliza para recorrer las escenas del viaje.</p>
        </div>
        <LavellaTripGallery trip={trip} />
      </section>
      <section className={styles.introduction}>
        <div>
          <p>{trip.description}</p>
        </div>
        <aside aria-label="Resumen de ruta">
          <span><b>{trip.durationDays} días</b><small>{trip.durationNights} noches</small></span>
          <span><b>{trip.cities.length}</b><small>destinos</small></span>
          <span><b>{trip.departures.length}</b><small>salidas</small></span>
        </aside>
      </section>
      <LavellaTripNavigation sections={sections} />
      <div className={styles.detailLayout}>
        <article className={styles.story}>
          <LavellaTripSections trip={trip} departureId={departureId} onDepartureChange={setDepartureId} />
        </article>
        <div id="reserva" className={styles.bookingColumn}>
          <LavellaBookingPanel agency={agency} trip={trip} departureId={departureId} onDepartureChange={setDepartureId} />
        </div>
      </div>
      {related.length > 0 && <section className={styles.related}>
        <header><small>OTRAS EXPERIENCIAS</small><h2>También te puede interesar</h2></header>
        <div>{related.slice(0, 3).map((item) => <LavellaTourCard key={item.id} trip={item} onOpen={() => onNavigate(`/viajes/${item.slug}`)} />)}</div>
      </section>}
    </main>
  );
}
