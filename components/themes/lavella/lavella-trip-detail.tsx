"use client";

import { useMemo, useState } from "react";
import {
  getStickyTripSections,
  resolveTripSections,
} from "@/lib/trip-sections";
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
  const gallerySection = resolveTripSections(trip).find(
    (section) => section.type === "gallery",
  );
  return (
    <main className={styles.detail} data-lavella-surface="light">
      <LavellaTripHero trip={trip} departureId={departureId} onBack={() => onNavigate("/viajes")} onReserve={() => document.getElementById("reserva")?.scrollIntoView({ behavior: "smooth" })} />
      {gallerySection && (
        <section
          id={gallerySection.id}
          className={styles.galleryStage}
          data-lavella-surface="light"
        >
          <div className={styles.galleryHeading}>
            <span>GALERÍA</span>
            <p>Desliza para recorrer las escenas del viaje.</p>
          </div>
          <LavellaTripGallery trip={trip} />
        </section>
      )}
      <LavellaTripNavigation sections={sections} />
      <div className={styles.detailLayout}>
        <article className={styles.story}>
          <LavellaTripSections
            trip={trip}
            departureId={departureId}
            onDepartureChange={setDepartureId}
            excludeTypes={["gallery"]}
          />
        </article>
        <div id="reserva" className={styles.bookingColumn}>
          <LavellaBookingPanel agency={agency} trip={trip} departureId={departureId} onDepartureChange={setDepartureId} />
        </div>
      </div>
      {related.length > 0 && <section className={styles.related}>
        <header><small>OTRAS EXPERIENCIAS</small><h2>También te puede interesar</h2></header>
        <div>{related.slice(0, 3).map((item) => <LavellaTourCard key={item.id} trip={item} variant="classic" onOpen={() => onNavigate(`/viajes/${item.slug}`)} />)}</div>
      </section>}
    </main>
  );
}
