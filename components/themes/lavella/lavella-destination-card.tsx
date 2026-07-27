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
    <article className={styles.destinationCard}>
      <button className={styles.destinationImage} onClick={() => onOpen(trip)}>
        <Image src={trip.featuredImage} alt="" fill sizes="(max-width:760px) 88vw, 31vw" />
      </button>
      <div className={styles.destinationBody}>
        <span>{trip.countries[0]?.slice(0, 2).toUpperCase() ?? "MX"}</span>
        <h3>{trip.cities[0] ?? trip.title}</h3>
        <p>{trip.summary}</p>
      </div>
      <footer>
        <small>{trip.departures.length} salidas</small>
        <button onClick={() => onOpen(trip)}>Ver viajes <FaArrowRight /></button>
      </footer>
    </article>
  );
}
