"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FaArrowRight, FaLocationDot } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
import styles from "./lavella-home.module.css";
import type { LavellaHomeProps } from "./lavella-types";
import {
  lavellaCategory,
  lavellaDate,
  lavellaDeparture,
  lavellaStartingPrice,
} from "./lavella-utils";

const categoryLabels = [
  "Fin de semana",
  "Excursiones",
  "Pueblos mágicos",
  "Naturaleza",
  "Playa",
] as const;

export function LavellaHomeHero({
  trips,
  onOpen,
  onNavigate,
}: Pick<LavellaHomeProps, "trips" | "onOpen" | "onNavigate">) {
  const slides = trips.slice(0, 4);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const current = slides[active] ?? trips[0];
  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(
      () => setActive((value) => (value + 1) % slides.length),
      7000,
    );
    return () => clearInterval(timer);
  }, [paused, slides.length]);
  if (!current) return null;
  const departure = lavellaDeparture(current);
  const price = lavellaStartingPrice(current, departure);
  const move = (step: number) => {
    setPaused(true);
    setActive((value) => (value + step + slides.length) % slides.length);
  };
  return (
    <section
      className={styles.hero}
      aria-roledescription="carrusel"
      aria-label="Viajes destacados"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touch.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX;
        if (touch.current !== null && end !== undefined && Math.abs(end - touch.current) > 45)
          move(end < touch.current ? 1 : -1);
        touch.current = null;
      }}
    >
      {slides.map((trip, index) => (
        <Image
          className={`${styles.heroImage} ${index === active ? styles.heroImageActive : ""}`}
          key={trip.id}
          src={trip.featuredImage}
          alt=""
          fill
          priority={index === 0}
          sizes="100vw"
        />
      ))}
      <div className={styles.heroOverlay} />
      <div className={styles.heroContent}>
        <small>{lavellaCategory(current)}</small>
        <h1>{current.title}</h1>
        <p>{current.subtitle}</p>
        <div className={styles.heroActions}>
          <button onClick={() => onOpen(current)}>Elegir este viaje</button>
          <button onClick={() => onNavigate("/viajes")}>Ver todos</button>
          <button className={styles.heroArrow} onClick={() => move(1)} aria-label="Siguiente viaje">
            <FaArrowRight />
          </button>
        </div>
      </div>
      <aside className={styles.heroCallout}>
        <FaLocationDot />
        <span>
          <small>Próxima salida · {lavellaDate(departure?.startDate)}</small>
          <b>
            Desde {formatMoney(price.amount, price.currency)}
          </b>
        </span>
      </aside>
      <div className={styles.heroDots}>
        {slides.map((trip, index) => (
          <button
            key={trip.id}
            className={index === active ? styles.heroDotActive : ""}
            onClick={() => {
              setPaused(true);
              setActive(index);
            }}
            aria-label={`Mostrar viaje ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
          />
        ))}
      </div>
      <div className={styles.heroCategories}>
        {categoryLabels.map((label, index) => {
          const trip = trips[index % trips.length];
          return (
            <button key={label} onClick={() => trip && onOpen(trip)}>
              <span>
                {trip && <Image src={trip.featuredImage} alt="" fill sizes="64px" />}
              </span>
              <b>{label}</b>
            </button>
          );
        })}
        <button className={styles.heroCategoryMore} onClick={() => onNavigate("/viajes")}>
          <span><FaArrowRight /></span>
          <b>Ver más rutas</b>
        </button>
      </div>
    </section>
  );
}
