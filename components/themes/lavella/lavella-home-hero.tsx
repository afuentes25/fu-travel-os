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
  subscribeLavellaMediaQuery,
  type SliderPauseReason,
  updateLavellaHoverPause,
  updateLavellaPauseReasons,
} from "./lavella-slider";
import type { LavellaHomeProps } from "./lavella-types";
import { LavellaArrowIcon } from "./lavella-arrow-icon";
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

type SlideDirection = "next" | "previous";

type LavellaAutoplayWindow = Window & {
  __fuTravelLavellaAutoplay?: {
    owner: symbol;
    timer: number;
  };
};

function startLavellaAutoplay(callback: () => void, delay: number) {
  const browserWindow = window as LavellaAutoplayWindow;
  const owner = Symbol("lavella-autoplay");
  const active = browserWindow.__fuTravelLavellaAutoplay;
  if (active) window.clearInterval(active.timer);
  const timer = window.setInterval(callback, delay);
  browserWindow.__fuTravelLavellaAutoplay = { owner, timer };

  return () => {
    if (browserWindow.__fuTravelLavellaAutoplay?.owner !== owner) return;
    window.clearInterval(timer);
    delete browserWindow.__fuTravelLavellaAutoplay;
  };
}

export function LavellaHomeHero({
  agency,
  trips,
  onOpen,
  onNavigate,
}: Pick<LavellaHomeProps, "agency" | "trips" | "onOpen" | "onNavigate">) {
  const slides = trips.slice(0, 4);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<SlideDirection>("next");
  const [pauseReasons, setPauseReasons] = useState<
    ReadonlySet<SliderPauseReason>
  >(() => new Set());
  const touch = useRef<number | null>(null);
  const hoverCapable = useRef(false);
  const keyboardNavigation = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionLocked = useRef(false);
  const settings = agency.settings.heroSliderSettings ?? {
    autoplay: true,
    ...LAVELLA_SLIDER_TIMING,
  };
  const setPauseReason = useCallback(
    (reason: SliderPauseReason, paused: boolean) => {
      setPauseReasons((value) =>
        updateLavellaPauseReasons(value, reason, paused),
      );
    },
    [],
  );
  const reducedMotion = pauseReasons.has("reduced-motion");
  const changeSlide = useCallback(
    (step: number) => {
      if (transitionLocked.current || slides.length < 2) return false;
      setDirection(step < 0 ? "previous" : "next");
      setActive((value) => lavellaSlideIndex(value, step, slides.length));
      if (!reducedMotion) {
        transitionLocked.current = true;
        if (transitionTimer.current) clearTimeout(transitionTimer.current);
        transitionTimer.current = setTimeout(() => {
          transitionTimer.current = null;
          transitionLocked.current = false;
        }, settings.transitionDurationMs);
      }
      return true;
    },
    [reducedMotion, settings.transitionDurationMs, slides.length],
  );

  useEffect(() => {
    const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
    const hoverMedia = matchMedia("(hover: hover) and (pointer: fine)");
    const syncMotion = () =>
      setPauseReason("reduced-motion", motionMedia.matches);
    const syncHover = () => {
      hoverCapable.current = hoverMedia.matches;
      if (!hoverMedia.matches) {
        setPauseReasons((value) =>
          updateLavellaHoverPause(value, false, false),
        );
        setPauseReason("focus", false);
      }
    };
    const syncVisibility = () => setPauseReason("hidden", document.hidden);
    const markKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === "Tab") keyboardNavigation.current = true;
    };
    const markPointerNavigation = () => {
      keyboardNavigation.current = false;
      setPauseReason("focus", false);
    };
    const unsubscribeMotion = subscribeLavellaMediaQuery(
      motionMedia,
      syncMotion,
    );
    const unsubscribeHover = subscribeLavellaMediaQuery(
      hoverMedia,
      syncHover,
    );
    document.addEventListener("visibilitychange", syncVisibility);
    document.addEventListener("keydown", markKeyboardNavigation);
    document.addEventListener("pointerdown", markPointerNavigation);
    syncMotion();
    syncHover();
    syncVisibility();
    return () => {
      unsubscribeMotion();
      unsubscribeHover();
      document.removeEventListener("visibilitychange", syncVisibility);
      document.removeEventListener("keydown", markKeyboardNavigation);
      document.removeEventListener("pointerdown", markPointerNavigation);
    };
  }, [setPauseReason]);

  useEffect(() => {
    if (
      !canLavellaAutoplay({
        autoplay: settings.autoplay,
        slideCount: slides.length,
        pauseReasons,
      })
    ) {
      return;
    }
    return startLavellaAutoplay(
      () => changeSlide(1),
      settings.autoplayDelayMs,
    );
  }, [
    changeSlide,
    pauseReasons,
    settings.autoplay,
    settings.autoplayDelayMs,
    slides.length,
  ]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    [],
  );

  if (slides.length === 0) return null;
  const pauseAfterInteraction = () => {
    setPauseReason("focus", false);
    setPauseReason("interaction", true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(
      () => {
        resumeTimer.current = null;
        setPauseReason("interaction", false);
      },
      settings.resumeAfterInteractionMs,
    );
  };
  const move = (step: number) => {
    pauseAfterInteraction();
    changeSlide(step);
  };
  const selectSlide = (index: number) => {
    if (index === active || transitionLocked.current) return;
    pauseAfterInteraction();
    setDirection(index < active ? "previous" : "next");
    setActive(index);
    if (!reducedMotion) {
      transitionLocked.current = true;
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        transitionTimer.current = null;
        transitionLocked.current = false;
      }, settings.transitionDurationMs);
    }
  };
  const outgoingIndex =
    direction === "next"
      ? lavellaSlideIndex(active, -1, slides.length)
      : lavellaSlideIndex(active, 1, slides.length);
  const controlsDisabled = slides.length < 2;
  return (
    <section
      className={styles.hero}
      data-lavella-surface="image"
      style={{ "--lavella-slider-transition": `${settings.transitionDurationMs}ms` } as CSSProperties}
      aria-roledescription="carrusel"
      aria-label="Viajes destacados"
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        setPauseReasons((value) =>
          updateLavellaHoverPause(value, true, hoverCapable.current),
        );
      }}
      onPointerLeave={() =>
        setPauseReasons((value) =>
          updateLavellaHoverPause(value, false, hoverCapable.current),
        )
      }
      onFocusCapture={(event) =>
        setPauseReason(
          "focus",
          keyboardNavigation.current &&
          event.target instanceof HTMLElement &&
            event.target.matches(":focus-visible"),
        )
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPauseReason("focus", false);
      }}
      onTouchStart={(event) => {
        setPauseReasons((value) =>
          updateLavellaHoverPause(value, false, false),
        );
        setPauseReason("focus", false);
        touch.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX;
        if (touch.current !== null && end !== undefined && Math.abs(end - touch.current) > 45)
          move(end < touch.current ? 1 : -1);
        touch.current = null;
      }}
    >
      {slides.map((trip, index) => {
        const isActive = index === active;
        const isOutgoing = index === outgoingIndex;
        const positionClass = isActive
          ? styles.heroSlideActive
          : isOutgoing
            ? direction === "next"
              ? styles.heroSlideExitLeft
              : styles.heroSlideExitRight
            : direction === "next"
              ? styles.heroSlideEnterRight
              : styles.heroSlideEnterLeft;
        const departure = lavellaDeparture(trip);
        const price = lavellaStartingPrice(trip, departure);
        return (
          <article
            className={`${styles.heroSlide} ${positionClass}`}
            key={trip.id}
            aria-hidden={!isActive}
            inert={!isActive}
          >
            <Image
              className={styles.heroImage}
              src={trip.featuredImage}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
            />
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <small>{lavellaCategory(trip)}</small>
              <h1>{trip.title}</h1>
              <p>{trip.subtitle}</p>
              <div className={styles.heroActions}>
                <button onClick={() => onOpen(trip)}>
                  Elegir este viaje
                </button>
                <button onClick={() => onNavigate("/viajes")}>
                  Ver todos
                </button>
              </div>
            </div>
            <aside className={styles.heroCallout}>
              <FaLocationDot />
              <span>
                <small>
                  Próxima salida · {lavellaDate(departure?.startDate)}
                </small>
                <b>Desde {formatMoney(price.amount, price.currency)}</b>
              </span>
            </aside>
          </article>
        );
      })}
      <div className={styles.heroControls} aria-label="Controles del carrusel">
        <button
          className={styles.heroArrow}
          type="button"
          onClick={() => move(-1)}
          aria-label="Mostrar viaje anterior"
          disabled={controlsDisabled}
        >
          <LavellaArrowIcon direction="previous" />
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
          <LavellaArrowIcon direction="next" />
        </button>
      </div>
      <div className={styles.heroDots}>
        {slides.map((trip, index) => (
          <button
            key={trip.id}
            className={index === active ? styles.heroDotActive : ""}
            onClick={() => selectSlide(index)}
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
          <span><LavellaArrowIcon direction="next" /></span>
          <b>Ver más rutas</b>
        </button>
      </div>
    </section>
  );
}
