import Image from "next/image";
import { FaArrowLeft, FaArrowRight, FaWhatsapp } from "react-icons/fa6";
import styles from "./lavella-home.module.css";
import { LavellaDestinationCard } from "./lavella-destination-card";
import { LavellaHomeHero } from "./lavella-home-hero";
import { LavellaSearchBox } from "./lavella-search-box";
import { LavellaTourCard } from "./lavella-tour-card";
import type { LavellaHomeProps } from "./lavella-types";
import { lavellaWhatsApp, openLavellaWhatsApp } from "./lavella-utils";

export function LavellaHome({
  agency,
  trips,
  onOpen,
  onNavigate,
}: LavellaHomeProps) {
  const compactDestinations = trips.slice(0, 10);
  return (
    <main className={styles.home}>
      <LavellaHomeHero trips={trips} onOpen={onOpen} onNavigate={onNavigate} />

      <section className={styles.popular}>
        <header className={styles.sectionHeadingDark}>
          <div>
            <small>LOS MÁS BUSCADOS</small>
            <h2>Viajes populares</h2>
          </div>
          <div>
            <button onClick={() => onNavigate("/viajes")}>Ver todos</button>
            <button aria-label="Anterior"><FaArrowLeft /></button>
            <button aria-label="Siguiente"><FaArrowRight /></button>
          </div>
        </header>
        <div className={styles.popularRail}>
          {trips.slice(0, 4).map((trip, index) => (
            <LavellaTourCard
              key={trip.id}
              trip={trip}
              onOpen={onOpen}
              featured={index === 0}
            />
          ))}
        </div>
        <div className={styles.benefits}>
          {[
            ["Cualquier ruta", "Diseñamos una salida que se adapte a tu manera de viajar."],
            ["Tu idea", "Una fecha libre puede convertirse en una historia inolvidable."],
            ["Nuestra garantía", "Información clara y acompañamiento antes de salir."],
          ].map(([title, text], index) => {
            const trip = trips[index + 1] ?? trips[0];
            return (
              <article key={title}>
                <span>{trip && <Image src={trip.featuredImage} alt="" fill sizes="130px" />}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.searchChapter}>
        <LavellaSearchBox
          onSearch={(query) =>
            onNavigate(query ? `/viajes?q=${encodeURIComponent(query)}` : "/viajes")
          }
        />
      </section>

      <section className={styles.destinations}>
        <header className={styles.sectionHeadingLight}>
          <div><small>AHORA MISMO</small><h2>Destinos populares</h2></div>
          <div>
            <button onClick={() => onNavigate("/destinos")}>Ver todos los destinos</button>
            <button aria-label="Destino anterior"><FaArrowLeft /></button>
            <button aria-label="Destino siguiente"><FaArrowRight /></button>
          </div>
        </header>
        <div className={styles.destinationRail}>
          {trips.slice(0, 6).map((trip) => (
            <LavellaDestinationCard key={trip.id} trip={trip} onOpen={onOpen} />
          ))}
        </div>
      </section>

      <section className={styles.operator}>
        <small>DESTINOS PRINCIPALES</small>
        <h2>{agency.branding.logoText} — operador de experiencias</h2>
        <div>
          <p>{agency.branding.heroDescription}</p>
          <p>Fechas, tarifas y acompañamiento reunidos en una experiencia de reserva clara.</p>
        </div>
        <div className={styles.destinationMiniRail}>
          {compactDestinations.map((trip) => (
            <button key={trip.id} onClick={() => onOpen(trip)}>
              <Image src={trip.featuredImage} alt="" fill sizes="115px" />
              <span>{trip.cities[0] ?? trip.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className={styles.promotion}
        style={{ backgroundImage: `url(${trips[3]?.featuredImage ?? trips[0]?.featuredImage})` }}
      >
        <div>
          <small>RUTAS DE TEMPORADA</small>
          <h2>Una salida especial merece un plan claro.</h2>
          <p>Consulta fechas, anticipo y condiciones directamente con {agency.name}.</p>
          <a
            href={lavellaWhatsApp(agency)}
            onClick={(event) => openLavellaWhatsApp(event, agency)}
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp /> Consultar disponibilidad
          </a>
        </div>
      </section>

      <section
        className={styles.journal}
        style={{ backgroundImage: `url(${trips[4]?.featuredImage ?? trips[0]?.featuredImage})` }}
      >
        <header><small>DIARIO DE VIAJE</small><h2>Historias para inspirar la próxima ruta</h2><p>Consejos prácticos, lugares y formas de disfrutar mejor cada salida.</p></header>
        <div>
          {trips.slice(0, 2).map((trip, index) => (
            <article key={trip.id}>
              <Image src={trip.featuredImage} alt="" width={520} height={300} />
              <time>{index + 8} agosto · 2026</time>
              <h3>{index ? "Cómo elegir una escapada de fin de semana" : `Antes de viajar a ${trip.cities[0] ?? trip.title}`}</h3>
              <p>{trip.summary}</p>
            </article>
          ))}
        </div>
        <button onClick={() => onNavigate("/nosotros")}>Ver todos los artículos</button>
      </section>
    </main>
  );
}
