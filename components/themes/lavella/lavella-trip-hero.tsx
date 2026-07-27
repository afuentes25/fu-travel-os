"use client";

import Image from "next/image";
import { FaLocationDot } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
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
    <section className={styles.tripHero} data-lavella-detail-hero>
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
            <span className={styles.rating}>
              ★★★★<i>★</i> <small>({trip.code})</small>
            </span>
            <h1>{trip.title}</h1>
            <p><FaLocationDot /> {trip.cities.join(" · ")}</p>
          </div>
          <div className={styles.tripHeroOffer}>
            <span><small>DESDE</small><strong>{formatMoney(price.amount, price.currency)}</strong></span>
            <span>{trip.durationDays} días · {lavellaDate(departure.startDate, true)}</span>
            <button onClick={onReserve}>Reservar ahora</button>
          </div>
        </div>
      </div>
    </section>
  );
}
