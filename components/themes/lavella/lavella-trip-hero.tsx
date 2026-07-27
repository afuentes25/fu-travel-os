"use client";

import Image from "next/image";
import { FaLocationDot } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
import { formatTripDuration } from "@/lib/trip-sections";
import type { TravelProduct } from "@/types";
import styles from "./lavella-detail.module.css";
import { lavellaDate, lavellaStartingPrice } from "./lavella-utils";

export function LavellaTripHero({
  trip,
  departureId,
  onBack,
  onReserve,
}: {
  trip: TravelProduct;
  departureId: string;
  onBack: () => void;
  onReserve: () => void;
}) {
  const departure = trip.departures.find((item) => item.id === departureId) ?? trip.departures[0];
  const price = lavellaStartingPrice(trip, departure);
  return (
    <section
      className={styles.tripHero}
      data-lavella-detail-hero
      data-lavella-surface="image"
    >
      {trip.heroMedia?.type === "video" ? (
        <video
          className={styles.tripHeroMedia}
          autoPlay={trip.heroMedia.autoplay}
          muted={trip.heroMedia.muted}
          loop={trip.heroMedia.loop}
          playsInline
          poster={trip.heroMedia.posterUrl}
        >
          <source src={trip.heroMedia.videoUrl} />
        </video>
      ) : (
        <Image
          src={trip.heroMedia?.type === "image" ? trip.heroMedia.imageUrl : trip.featuredImage}
          alt={trip.heroMedia?.type === "image" ? trip.heroMedia.imageAlt : trip.title}
          fill
          priority
          sizes="100vw"
          style={
            trip.heroMedia?.type === "image"
              ? { objectPosition: `${trip.heroMedia.focalPoint?.x ?? 50}% ${trip.heroMedia.focalPoint?.y ?? 50}%` }
              : undefined
          }
        />
      )}
      <div className={styles.tripHeroShade} />
      <div className={styles.heroContainer}>
        <button className={styles.back} onClick={onBack}>
          Inicio <span>/</span> Viajes <span>/</span> {trip.cities[0]}
        </button>
        <div className={styles.tripHeroRow}>
          <div className={styles.tripHeroCopy}>
            <span className={styles.heroKicker}>{trip.code} · {trip.categoryIds[0]?.replaceAll("_", " ")}</span>
            <h1>{trip.title}</h1>
            <p className={styles.heroDescription}>{trip.subtitle ?? trip.summary}</p>
            <p className={styles.heroLocation}><FaLocationDot /> {trip.cities.join(" · ")}</p>
          </div>
          <div className={styles.tripHeroOffer}>
            <span className={styles.heroPrice}><small>DESDE</small><strong>{formatMoney(price.amount, price.currency)}</strong></span>
            {trip.foreignCurrencyPricing?.displayCurrencyMode ===
              "source_and_estimated_mxn" && (
              <span className={styles.heroFxNote}>
                Equivalente estimado en MXN según la tasa vigente
              </span>
            )}
            <span className={styles.heroMeta}>
              {formatTripDuration(
                trip.durationDays,
                trip.durationNights,
              )}
            </span>
            <span className={styles.heroMeta}>Próxima salida · {lavellaDate(departure.startDate, true)}</span>
            <button onClick={onReserve}>Reservar ahora</button>
          </div>
        </div>
      </div>
    </section>
  );
}
