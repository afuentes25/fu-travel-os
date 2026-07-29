import Image from "next/image";
import { formatMoney } from "@/lib/pricing";
import styles from "./lavella-home.module.css";
import type { LavellaCardProps } from "./lavella-types";
import {
  lavellaDate,
  lavellaDeparture,
  lavellaStartingPrice,
} from "./lavella-utils";

export function LavellaTourCard({
  trip,
  onOpen,
  featured = false,
  variant = "cinematic",
}: LavellaCardProps) {
  const departure = lavellaDeparture(trip);
  const price = lavellaStartingPrice(trip, departure);
  const promotion = trip.promotion?.trim();
  if (variant === "classic") {
    return (
      <article className={styles.tourClassicCard} data-lavella-surface="image">
        <button
          onClick={() => onOpen(trip)}
          aria-label={`Ver detalles de ${trip.title}`}
        >
          <Image src={trip.featuredImage} alt="" fill sizes="(max-width:760px) 92vw, (max-width:1100px) 45vw, 24vw" />
          <span className={styles.tourClassicShade} />
          {promotion && <em>{promotion}</em>}
          <div className={styles.tourClassicContent}>
            <small>{trip.cities[0] ?? trip.countries[0]}</small>
            <h3>{trip.title}</h3>
            <p>
              <span><img src="/themes/lavella/clock.svg" alt="" />{trip.durationDays} {trip.durationDays === 1 ? "día" : "días"}</span>
              <span>{lavellaDate(departure?.startDate)}</span>
            </p>
            <b>Desde {formatMoney(price.amount, price.currency)}</b>
          </div>
        </button>
      </article>
    );
  }
  return (
    <article className={`${styles.tourCard} ${featured ? styles.tourCardFeatured : ""}`}>
      <button
        onClick={() => onOpen(trip)}
        aria-label={`Ver detalles de ${trip.title}`}
      >
        <Image src={trip.featuredImage} alt="" fill sizes={featured ? "65vw" : "(max-width:760px) 92vw, 48vw"} />
        <span className={styles.tourShade} />
        {promotion && <em>{promotion}</em>}
        <div className={styles.tourCardContent}>
          <h3>
            {trip.title} <i>|</i>{" "}
            {formatMoney(price.amount, price.currency)}
          </h3>
          <p>{trip.subtitle}</p>
          <small>
            <img src="/themes/lavella/clock.svg" alt="" />
            {trip.durationDays} {trip.durationDays === 1 ? "día" : "días"}
          </small>
        </div>
      </button>
    </article>
  );
}
