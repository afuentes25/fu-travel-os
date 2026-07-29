import Image from "next/image";
import { FaArrowRight } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
import type { TravelProduct } from "@/types";
import styles from "./lavella-catalog.module.css";
import {
  lavellaDate,
  lavellaDeparture,
  lavellaStartingPrice,
} from "./lavella-utils";
import {
  lavellaCatalogDuration,
  lavellaCatalogTransport,
} from "./lavella-catalog-card-utils";

export function LavellaCatalogCard({
  trip,
  onOpen,
}: {
  trip: TravelProduct;
  onOpen: (trip: TravelProduct) => void;
}) {
  const departure = lavellaDeparture(trip);
  const price = lavellaStartingPrice(trip, departure);
  const promotion = trip.promotion?.trim();
  const description = trip.subtitle?.trim() || trip.summary;

  return (
    <article className={styles.catalogCard}>
      <div className={styles.catalogCardMedia}>
        <button
          type="button"
          onClick={() => onOpen(trip)}
          aria-label={`Ver detalles de ${trip.title}`}
        >
          <Image
            src={trip.featuredImage}
            alt=""
            fill
            sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) 44vw, 29vw"
          />
        </button>
        {promotion && (
          <span className={styles.catalogCardBadge}>{promotion}</span>
        )}
      </div>

      <div className={styles.catalogCardBody}>
        <h3>
          <button type="button" onClick={() => onOpen(trip)}>
            {trip.title}
          </button>
        </h3>
        <p className={styles.catalogCardDescription}>{description}</p>

        <dl className={styles.catalogCardMeta}>
          <div>
            <dt>Duración</dt>
            <dd>{lavellaCatalogDuration(trip.durationDays)}</dd>
          </div>
          <div>
            <dt>Próxima salida</dt>
            <dd>{lavellaDate(departure?.startDate, true)}</dd>
          </div>
          <div>
            <dt>Transporte</dt>
            <dd>{lavellaCatalogTransport(trip.transportTypes)}</dd>
          </div>
        </dl>

        <div className={styles.catalogCardFooter}>
          <div className={styles.catalogCardPrice}>
            <span>Desde</span>
            <strong>{formatMoney(price.amount, price.currency)}</strong>
          </div>
          <button
            className={styles.catalogCardCta}
            type="button"
            onClick={() => onOpen(trip)}
          >
            Ver detalles
            <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
