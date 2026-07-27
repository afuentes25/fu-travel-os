import Image from "next/image";
import { formatMoney } from "@/lib/pricing";
import styles from "./lavella-home.module.css";
import type { LavellaCardProps } from "./lavella-types";
import {
  lavellaDeparture,
  lavellaStartingPrice,
} from "./lavella-utils";

export function LavellaTourCard({
  trip,
  onOpen,
  featured = false,
}: LavellaCardProps) {
  const departure = lavellaDeparture(trip);
  const price = lavellaStartingPrice(trip, departure);
  return (
    <article className={`${styles.tourCard} ${featured ? styles.tourCardFeatured : ""}`}>
      <button onClick={() => onOpen(trip)} aria-label={`Ver ${trip.title}`}>
        <Image src={trip.featuredImage} alt="" fill sizes={featured ? "65vw" : "(max-width:760px) 92vw, 48vw"} />
        <span className={styles.tourShade} />
        {trip.promotion && <em>{trip.promotion}</em>}
        <div className={styles.tourCardContent}>
          <div className={styles.rating} aria-label="Calificación 4 de 5">
            {[0, 1, 2, 3, 4].map((star) => (
              <img
                key={star}
                src={star < 4 ? "/themes/lavella/star-active.svg" : "/themes/lavella/star.svg"}
                alt=""
              />
            ))}
            <span>({trip.departures.length + 1} reseñas)</span>
          </div>
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
