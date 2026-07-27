"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { FaLocationDot } from "react-icons/fa6";
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

export const LAVELLA_SLIDER_AUTOPLAY_MS = 5000;
export const LAVELLA_SLIDER_TRANSITION_MS = 650;
export const LAVELLA_SLIDER_RESUME_AFTER_INTERACTION_MS = 7000;

export function LavellaHomeHero({
  agency,
  trips,
  onOpen,
  onNavigate,
}: Pick<LavellaHomeProps, "agency" | "trips" | "onOpen" | "onNavigate">) {
  const slides = trips.slice(0, 4);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touch = useRef<number | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = agency.settings.heroSliderSettings ?? {
    autoplay: true,
    autoplayDelayMs: LAVELLA_SLIDER_AUTOPLAY_MS,
    transitionDurationMs: LAVELLA_SLIDER_TRANSITION_MS,
    resumeAfterInteractionMs: LAVELLA_SLIDER_RESUME_AFTER_INTERACTION_MS,
  };
  const current = slides[active] ?? trips[0];
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setTabHidden(document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);
  useEffect(() => {
    if (
      !settings.autoplay ||
      hovered ||
      focusWithin ||
      interactionPaused ||
      tabHidden ||
      reducedMotion ||
      slides.length < 2
    ) return;
    const timer = setTimeout(
      () => setActive((value) => (value + 1) % slides.length),
      settings.autoplayDelayMs,
    );
    return () => clearTimeout(timer);
  }, [active, focusWithin, hovered, interactionPaused, reducedMotion, settings.autoplay, settings.autoplayDelayMs, slides.length, tabHidden]);
  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  if (!current) return null;
  const departure = lavellaDeparture(current);
  const price = lavellaStartingPrice(current, departure);
  const pauseAfterInteraction = () => {
    setInteractionPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(
      () => setInteractionPaused(false),
      settings.resumeAfterInteractionMs,
    );
  };
  const move = (step: number) => {
    pauseAfterInteraction();
    setActive((value) => (value + step + slides.length) % slides.length);
  };
  return (
    <section
      className={styles.hero}
      data-lavella-surface="image"
      style={{ "--lavella-slider-transition": `${settings.transitionDurationMs}ms` } as CSSProperties}
      aria-roledescription="carrusel"
      aria-label="Viajes destacados"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
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
            <img src="/themes/lavella/slide-arrow.svg" alt="" width="20" height="14" />
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
              pauseAfterInteraction();
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
          <span><img src="/themes/lavella/slide-arrow.svg" alt="" width="20" height="14" /></span>
          <b>Ver más rutas</b>
        </button>
      </div>
    </section>
  );
}
