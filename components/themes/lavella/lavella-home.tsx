"use client";

import Image from "next/image";
import { useRef } from "react";
import { FaArrowLeft, FaArrowRight, FaWhatsapp } from "react-icons/fa6";
import styles from "./lavella-home.module.css";
import { LavellaDestinationCard } from "./lavella-destination-card";
import { LavellaHomeHero } from "./lavella-home-hero";
import { LavellaSearchBox } from "./lavella-search-box";
import { lavellaRailTarget } from "./lavella-slider";
import { LavellaTourCard } from "./lavella-tour-card";
import type { LavellaHomeProps } from "./lavella-types";
import { lavellaWhatsApp, openLavellaWhatsApp } from "./lavella-utils";

export function LavellaHome({
  agency,
  trips,
  onOpen,
  onNavigate,
}: LavellaHomeProps) {
  const popularRail = useRef<HTMLDivElement>(null);
  const destinationsRail = useRef<HTMLDivElement>(null);
  const movePopular = (direction: -1 | 1) => {
    const rail = popularRail.current;
    const card = rail?.firstElementChild;
    if (!(rail && card instanceof HTMLElement)) return;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    rail.scrollTo({
      left: lavellaRailTarget({
        currentScroll: rail.scrollLeft,
        maxScroll,
        itemStep: card.getBoundingClientRect().width + gap,
        direction,
      }),
      behavior: "smooth",
    });
  };
  const moveDestinations = (direction: number) =>
    destinationsRail.current?.scrollBy({
      left: direction * 444,
      behavior: "smooth",
    });
  return (
    <main className={styles.home}>
      <LavellaHomeHero agency={agency} trips={trips} onOpen={onOpen} onNavigate={onNavigate} />

      <section className={styles.popular} data-lavella-surface="dark">
        <header className={styles.sectionHeadingDark}>
          <div>
            <small>LOS MÁS BUSCADOS</small>
            <h2>Viajes populares</h2>
          </div>
          <div>
            <button onClick={() => onNavigate("/viajes")}>Ver todos</button>
            <button
              className={styles.carouselArrowButton}
              type="button"
              aria-label="Viaje popular anterior"
              onClick={() => movePopular(-1)}
            >
              <FaArrowLeft />
            </button>
            <button
              className={styles.carouselArrowButton}
              type="button"
              aria-label="Siguiente viaje popular"
              onClick={() => movePopular(1)}
            >
              <FaArrowRight />
            </button>
          </div>
        </header>
        <div className={styles.popularRail} ref={popularRail}>
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

      <section className={styles.searchChapter} data-lavella-surface="light">
        <LavellaSearchBox
          onSearch={(query) =>
            onNavigate(query ? `/viajes?q=${encodeURIComponent(query)}` : "/viajes")
          }
        />
      </section>

      <section className={styles.classicPopular} data-lavella-surface="light">
        <header className={styles.classicPopularHeading}>
          <div>
            <small>VIAJES POPULARES</small>
            <h2>Próximas expediciones</h2>
          </div>
          <p>Una selección de salidas activas, desde escapadas de un día hasta grandes circuitos.</p>
        </header>
        <div className={styles.classicPopularGrid}>
          {trips.slice(0, 8).map((trip) => (
            <LavellaTourCard
              key={trip.id}
              trip={trip}
              onOpen={onOpen}
              variant="classic"
            />
          ))}
        </div>
        <button className={styles.classicPopularMore} onClick={() => onNavigate("/viajes")}>
          Ver todos los viajes <FaArrowRight />
        </button>
      </section>

      <section className={styles.destinations} data-lavella-surface="light">
        <header className={styles.sectionHeadingLight}>
          <div><small>AHORA MISMO</small><h2>Destinos populares</h2></div>
          <div>
            <button onClick={() => onNavigate("/destinos")}>Ver todos los destinos</button>
            <button
              className={styles.carouselArrowButton}
              aria-label="Destino anterior"
              onClick={() => moveDestinations(-1)}
            >
              <FaArrowLeft />
            </button>
            <button
              className={styles.carouselArrowButton}
              aria-label="Destino siguiente"
              onClick={() => moveDestinations(1)}
            >
              <FaArrowRight />
            </button>
          </div>
        </header>
        <div className={styles.destinationRail} ref={destinationsRail}>
          {trips.slice(0, 8).map((trip) => (
            <LavellaDestinationCard
              key={trip.id}
              trip={trip}
              onOpen={onOpen}
            />
          ))}
        </div>
      </section>

      <section className={styles.operator} data-lavella-surface="light">
        <small>DESTINOS PRINCIPALES</small>
        <h2>{agency.branding.logoText} — operador de experiencias</h2>
        <div>
          <p>{agency.branding.heroDescription}</p>
          <p>Fechas, tarifas y acompañamiento reunidos en una experiencia de reserva clara.</p>
        </div>
      </section>

      <section
        className={styles.promotion}
        data-lavella-surface="image"
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
        data-lavella-surface="image"
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
