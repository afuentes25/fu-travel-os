"use client";

import Image from "next/image";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FaLocationDot } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
import styles from "./lavella-home.module.css";
import {
  canLavellaAutoplay,
  lavellaSlideIndex,
  LAVELLA_SLIDER_TIMING,
  type SliderPauseReason,
  updateLavellaPauseReasons,
} from "./lavella-slider";
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

function LavellaHeroArrow({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg
      className={styles.heroArrowIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {direction === "previous" ? (
        <path d="M13.75 5.5 7.25 12l6.5 6.5M7.5 12h9.25" />
      ) : (
        <path d="m10.25 5.5 6.5 6.5-6.5 6.5M16.5 12H7.25" />
      )}
    </svg>
  );
}

export function LavellaHomeHero({
  agency,
  trips,
  onOpen,
  onNavigate,
}: Pick<LavellaHomeProps, "agency" | "trips" | "onOpen" | "onNavigate">) {
  const slides = trips.slice(0, 4);
  const [active, setActive] = useState(0);
  const [pauseReasons, setPauseReasons] = useState<
    ReadonlySet<SliderPauseReason>
  >(() => new Set());
  const touch = useRef<number | null>(null);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = agency.settings.heroSliderSettings ?? {
    autoplay: true,
    ...LAVELLA_SLIDER_TIMING,
  };
  const current = slides[active] ?? trips[0];
  const setPauseReason = useCallback(
    (reason: SliderPauseReason, paused: boolean) => {
      setPauseReasons((value) =>
        updateLavellaPauseReasons(value, reason, paused),
      );
    },
    [],
  );

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setPauseReason("reduced-motion", media.matches);
    const syncVisibility = () => setPauseReason("hidden", document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [setPauseReason]);

  useEffect(() => {
    if (autoplayTimer.current) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
    if (
      !canLavellaAutoplay({
        autoplay: settings.autoplay,
        slideCount: slides.length,
        pauseReasons,
      })
    ) {
      return;
    }
    autoplayTimer.current = setInterval(() => {
      setActive((value) => lavellaSlideIndex(value, 1, slides.length));
    }, settings.autoplayDelayMs);
    return () => {
      if (autoplayTimer.current) {
        clearInterval(autoplayTimer.current);
        autoplayTimer.current = null;
      }
    };
  }, [
    pauseReasons,
    settings.autoplay,
    settings.autoplayDelayMs,
    slides.length,
  ]);

  useEffect(
    () => () => {
      if (autoplayTimer.current) clearInterval(autoplayTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  if (!current) return null;
  const departure = lavellaDeparture(current);
  const price = lavellaStartingPrice(current, departure);
  const pauseAfterInteraction = () => {
    setPauseReason("interaction", true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(
      () => setPauseReason("interaction", false),
      settings.resumeAfterInteractionMs,
    );
  };
  const move = (step: number) => {
    pauseAfterInteraction();
    setActive((value) => lavellaSlideIndex(value, step, slides.length));
  };
  const controlsDisabled = slides.length < 2;
  return (
    <section
      className={styles.hero}
      data-lavella-surface="image"
      style={{ "--lavella-slider-transition": `${settings.transitionDurationMs}ms` } as CSSProperties}
      aria-roledescription="carrusel"
      aria-label="Viajes destacados"
      onMouseEnter={() => setPauseReason("hover", true)}
      onMouseLeave={() => setPauseReason("hover", false)}
      onFocusCapture={() => setPauseReason("focus", true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPauseReason("focus", false);
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
      <div className={styles.heroControls} aria-label="Controles del carrusel">
        <button
          className={styles.heroArrow}
          type="button"
          onClick={() => move(-1)}
          aria-label="Mostrar viaje anterior"
          disabled={controlsDisabled}
        >
          <LavellaHeroArrow direction="previous" />
        </button>
        <output className={styles.heroCounter} aria-live="polite">
          {String(active + 1).padStart(2, "0")} /{" "}
          {String(slides.length).padStart(2, "0")}
        </output>
        <button
          className={styles.heroArrow}
          type="button"
          onClick={() => move(1)}
          aria-label="Mostrar siguiente viaje"
          disabled={controlsDisabled}
        >
          <LavellaHeroArrow direction="next" />
        </button>
      </div>
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
            disabled={controlsDisabled}
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
          <span><LavellaHeroArrow direction="next" /></span>
          <b>Ver más rutas</b>
        </button>
      </div>
    </section>
  );
}
