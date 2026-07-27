import Image from "next/image";
import { FaArrowRight } from "react-icons/fa6";
import styles from "./lavella-home.module.css";
import type { TravelProduct } from "@/types";

export function LavellaDestinationCard({
  trip,
  onOpen,
}: {
  trip: TravelProduct;
  onOpen: (trip: TravelProduct) => void;
}) {
  return (
    <article className={styles.destinationCard} data-lavella-surface="light">
      <button
        className={styles.destinationImage}
        data-lavella-surface="image"
        onClick={() => onOpen(trip)}
        aria-label={`Ver viajes a ${trip.cities[0] ?? trip.title}`}
      >
        <Image src={trip.featuredImage} alt="" fill sizes="(max-width:760px) 88vw, 31vw" />
      </button>
      <div className={styles.destinationBody}>
        <span>{trip.countries[0]?.slice(0, 2).toUpperCase() ?? "MX"}</span>
        <h3>{trip.cities[0] ?? trip.title}</h3>
        <p>{trip.summary}</p>
      </div>
      <div className={styles.destinationCardFooter}>
        <small>{trip.departures.length} salidas</small>
        <button onClick={() => onOpen(trip)}>Ver viajes <FaArrowRight /></button>
      </div>
    </article>
  );
}
