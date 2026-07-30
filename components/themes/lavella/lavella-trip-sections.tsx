"use client";

import Image from "next/image";
import { useState } from "react";
import { FaCheck, FaDownload, FaLocationDot, FaXmark } from "react-icons/fa6";
import { formatMoney, isDepartureBookable } from "@/lib/pricing";
import {
  formatTripDuration,
  getEffectiveRateAmount,
  getInitialItineraryOpenDays,
  getOrderedRouteStops,
  getPublicDeparturePoints,
  getRecommendationItems,
  getSafeVideoPresentation,
  getTripDisplayStartingPrice,
  getVisitedDestinations,
  isSafeDownloadUrl,
  resolveTripSections,
} from "@/lib/trip-sections";
import type { TravelProduct, TripSectionType } from "@/types";
import styles from "./lavella-detail.module.css";
import { lavellaDate } from "./lavella-utils";

const cleanText = (value?: string) => value?.trim() ?? "";
const normalizeText = (value?: string) =>
  cleanText(value).toLocaleLowerCase("es-MX").replace(/\s+/g, " ");

function getItineraryContext(
  day: TravelProduct["itinerary"][number],
  settings: TravelProduct["itinerarySettings"],
) {
  const description = normalizeText(day.description);
  const details: string[] = [];
  const showTimes = settings?.showTimes !== false;
  const showStops = settings?.showStops !== false;

  if (showTimes && day.startTime && !description.includes(normalizeText(day.startTime))) {
    details.push(
      day.endTime
        ? `La jornada está prevista de ${day.startTime} a ${day.endTime}.`
        : `La jornada comienza a las ${day.startTime}.`,
    );
  }

  const stopNames = showStops
    ? [...(day.stops ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((stop) => cleanText(stop.name))
        .filter((name) => name && !description.includes(normalizeText(name)))
    : [];
  if (stopNames.length) {
    details.push(`El recorrido contempla ${stopNames.join(" · ")}.`);
  }

  return details.join(" ");
}

function LavellaItinerary({ trip, sectionId, title }: { trip: TravelProduct; sectionId: string; title?: string }) {
  const settings = trip.itinerarySettings;
  const [openDays, setOpenDays] = useState(() =>
    getInitialItineraryOpenDays(settings?.displayMode ?? "first_open", trip.itinerary.length),
  );
  const toggle = (index: number) =>
    setOpenDays((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  return (
    <section id={sectionId} className={styles.informativeSection}>
      <small>PROGRAMA DEL VIAJE</small>
      <div className={styles.itineraryTitle}>
        <h2>{title}</h2>
        <div>
          {settings?.allowExpandAll && <button onClick={() => setOpenDays(trip.itinerary.map((_, index) => index))}>Desplegar todo</button>}
          {settings?.allowCollapseAll && <button onClick={() => setOpenDays([])}>Contraer todo</button>}
        </div>
      </div>
      <div className={styles.itinerary}>
        {trip.itinerary.map((day, index) => {
          const open = openDays.includes(index);
          const context = getItineraryContext(day, settings);
          return (
            <article key={day.id ?? `day-${day.day}`} className={open ? styles.itineraryOpen : undefined}>
              <button className={styles.itineraryTrigger} onClick={() => toggle(index)} aria-expanded={open}>
                <b>Día {day.day}</b>
                <span>{day.title}</span>
                <i>+</i>
              </button>
              {open && <div className={styles.itineraryBody}>
                {day.description.split(/\n+/).map(cleanText).filter(Boolean).map((paragraph, paragraphIndex) => (
                  <p key={`${day.id ?? day.day}-paragraph-${paragraphIndex}`}>{paragraph}</p>
                ))}
                {context && <p className={styles.itineraryContext}>{context}</p>}
                {settings?.showImages && day.images?.length ? <div className={styles.itineraryImages}>{day.images.slice(0, 3).map((image) => <figure key={image.id}><Image src={image.url} alt={image.alt} fill sizes="240px" /></figure>)}</div> : null}
              </div>}
            </article>
          );
        })}
      </div>
      {trip.itineraryDownload?.enabled && trip.itineraryDownload.fileUrl && isSafeDownloadUrl(trip.itineraryDownload.fileUrl) && (
        <aside className={styles.downloadBand}>
          <div><small>ITINERARIO COMPLETO</small><h3>{trip.itineraryDownload.title ?? "Lleva la ruta contigo"}</h3><p>{trip.itineraryDownload.description}</p></div>
          <a href={trip.itineraryDownload.fileUrl} download><FaDownload /> Descargar {trip.itineraryDownload.fileSizeLabel}</a>
        </aside>
      )}
    </section>
  );
}

export function LavellaTripSections({
  trip,
  departureId,
  onDepartureChange,
  excludeTypes = [],
}: {
  trip: TravelProduct;
  departureId: string;
  onDepartureChange: (id: string) => void;
  excludeTypes?: TripSectionType[];
}) {
  const sections = resolveTripSections(trip).filter(
    (section) =>
      section.type !== "related_trips" &&
      !excludeTypes.includes(section.type),
  );
  const selected = trip.departures.find((item) => item.id === departureId) ?? trip.departures[0];
  const destinations = getVisitedDestinations(trip.itinerary);
  const video = getSafeVideoPresentation(trip.videoContent);
  const summaryText = cleanText(trip.summaryContent?.shortDescription ?? trip.summary);
  const repeatedInformation = new Set(
    [summaryText, ...trip.itinerary.flatMap((day) => [day.title, day.description])]
      .map(normalizeText)
      .filter(Boolean),
  );
  return (
    <div className={styles.sections}>
      {sections.map((section) => {
        const title = section.title ?? section.anchorLabel;
        if (section.type === "summary") {
          const price = getTripDisplayStartingPrice({ trip, departure: selected });
          if (!summaryText) return null;
          return <section id={section.id} key={section.id} className={`${styles.summary} ${styles.informativeSection}`}>
            <small>ACERCA DEL VIAJE</small><h2>{title}</h2>
            <p>{summaryText}</p>
            <div className={styles.summaryFacts}>
              <span><b>{formatTripDuration(trip.durationDays, trip.durationNights)}</b><small>Duración</small></span>
              <span><b>{destinations.join(" · ") || trip.cities.join(" · ")}</b><small>Visitando</small></span>
              <span><b>{formatMoney(price.amount, price.currency)}</b><small>{price.label}</small></span>
            </div>
            {trip.foreignCurrencyPricing?.displayCurrencyMode ===
              "source_and_estimated_mxn" && (
              <p className={styles.summaryFxNote}>
                La tarifa se adeuda en USD. Cada cobro se convierte a MXN con
                la cotización vigente del intento de pago.
              </p>
            )}
          </section>;
        }
        if (section.type === "video" && video) return <section id={section.id} key={section.id}>
          <small>VIDEO</small><h2>{trip.videoContent?.title ?? title}</h2>
          {video.mode === "iframe" ? <iframe className={styles.video} src={video.url} title={trip.videoContent?.title ?? "Video del viaje"} loading="lazy" /> : <a className={styles.download} href={video.url} target="_blank" rel="noreferrer">Ver video</a>}
          <p>{trip.videoContent?.caption}</p>
        </section>;
        if (section.type === "gallery") return <section id={section.id} key={section.id}>
          <small>GALERÍA</small><h2>{title}</h2>
          <div className={styles.gallery}>
            {(trip.galleryImages ?? []).slice(0, 5).map((image, index) => <figure key={image.id} className={index === 0 ? styles.galleryLead : undefined}><Image src={image.url} alt={image.alt} fill sizes={index === 0 ? "60vw" : "30vw"} /><figcaption>{image.caption}</figcaption></figure>)}
          </div>
        </section>;
        if (section.type === "itinerary") return <LavellaItinerary key={section.id} trip={trip} sectionId={section.id} title={title} />;
        if (section.type === "custom" && trip.itineraryDownload?.enabled && trip.itineraryDownload.fileUrl && isSafeDownloadUrl(trip.itineraryDownload.fileUrl)) return <section id={section.id} key={section.id} className={styles.downloadBand}>
          <div><small>ITINERARIO COMPLETO</small><h2>{trip.itineraryDownload.title ?? title}</h2></div><a href={trip.itineraryDownload.fileUrl} download><FaDownload /> Descargar</a>
        </section>;
        if (section.type === "included") {
          const included = (trip.inclusionsContent?.included ?? []).filter((item) => cleanText(item.text));
          const excluded = (trip.inclusionsContent?.excluded ?? []).filter((item) => cleanText(item.text));
          if (!included.length && !excluded.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>SERVICIOS</small><h2>{title}</h2><div className={styles.includes}>
              {included.length ? <div><h3>Incluye</h3>{included.map((item) => <p key={item.id}><FaCheck /> {item.text}</p>)}</div> : null}
              {excluded.length ? <div><h3>No incluye</h3>{excluded.map((item) => <p key={item.id}><FaXmark /> {item.text}</p>)}</div> : null}
            </div>
          </section>;
        }
        if (section.type === "map") {
          const routeStops = getOrderedRouteStops(trip.mapSettings).filter((stop) => cleanText(stop.name));
          if (!routeStops.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>RUTA</small><h2>{title}</h2><div className={styles.route}>{routeStops.map((stop) => <span key={stop.id}><b>{stop.dayNumber}</b><i><FaLocationDot /></i>{stop.name}</span>)}</div>
          </section>;
        }
        if (section.type === "departures") return <section id={section.id} key={section.id}>
          <small>FECHAS DISPONIBLES</small><h2>{title}</h2><div className={styles.departures}>{trip.departures.map((item) => {
            const price = getTripDisplayStartingPrice({ trip, departure: item });
            return <button key={item.id} className={item.id === selected.id ? styles.departureActive : undefined} onClick={() => onDepartureChange(item.id)} disabled={!isDepartureBookable(item)}>
              <time>{lavellaDate(item.startDate, true)}</time><span>Desde {formatMoney(price.amount, price.currency)}</span><b>{!isDepartureBookable(item) ? "Finalizada" : item.saleStatus === "limited" ? "Últimos lugares" : "Disponible"}</b>
            </button>;
          })}</div>
        </section>;
        if (section.type === "rates") return <section id={section.id} key={section.id}>
          <small>TARIFAS</small><h2>{title}</h2><div className={styles.rates}>{trip.pricingOptions.map((rate) => <article key={rate.id}><span>{rate.label}</span><strong>{formatMoney(getEffectiveRateAmount({ trip, departure: selected, rate }), rate.currency)}</strong>{rate.occupancy === "double" && <small>Precio de referencia</small>}</article>)}</div>
        </section>;
        if (section.type === "recommendations") {
          const recommendations = getRecommendationItems(trip).filter((item) => cleanText(item.text));
          if (!recommendations.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>ANTES DE VIAJAR</small><h2>{title}</h2><ul className={styles.recommendations}>{recommendations.map((item) => <li key={item.id}>{item.text}</li>)}</ul>
          </section>;
        }
        if (section.type === "departure_points") {
          const points = getPublicDeparturePoints(trip.publicDeparturePoints).filter((point) => cleanText(point.name));
          if (!points.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>PUNTOS DE SALIDA</small><h2>{title}</h2><div className={styles.points}>{points.map((point) => <article key={point.id}><b>{point.name}</b>{[point.city, point.reference, point.meetingTime].some(Boolean) && <p>{[point.city, point.reference, point.meetingTime].filter(Boolean).join(" · ")}</p>}</article>)}</div>
          </section>;
        }
        if (section.type === "important_information") {
          const information = (trip.importantInformation?.items ?? []).filter((item) => {
            const itemTitle = cleanText(item.title);
            const itemDescription = cleanText(item.description);
            return Boolean(
              itemTitle &&
              itemDescription &&
              !repeatedInformation.has(normalizeText(itemDescription)) &&
              !repeatedInformation.has(normalizeText(`${itemTitle} ${itemDescription}`)),
            );
          });
          if (!information.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>INFORMACIÓN IMPORTANTE</small><h2>{title}</h2>{information.map((item) => <article className={styles.information} key={item.id}><h3>{item.title}</h3><p>{item.description}</p></article>)}
          </section>;
        }
        if (section.type === "faq") {
          const faqItems = (trip.faqContent?.items ?? []).filter((item) => cleanText(item.question) && cleanText(item.answer));
          if (!faqItems.length) return null;
          return <section id={section.id} key={section.id} className={styles.informativeSection}>
            <small>PREGUNTAS FRECUENTES</small><h2>{title}</h2><div className={styles.faq}>{faqItems.map((item) => <details key={item.id}><summary>{item.question}<i>+</i></summary><p>{item.answer}</p></details>)}</div>
          </section>;
        }
        return null;
      })}
    </div>
  );
}
