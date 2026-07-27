"use client";

import Image from "next/image";
import { useState } from "react";
import { FaCheck, FaDownload, FaLocationDot, FaXmark } from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
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
import type { TravelProduct } from "@/types";
import styles from "./lavella-detail.module.css";
import { lavellaDate } from "./lavella-utils";

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
    <section id={sectionId}>
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
          return (
            <article key={day.id ?? `day-${day.day}`} className={open ? styles.itineraryOpen : undefined}>
              <button className={styles.itineraryTrigger} onClick={() => toggle(index)} aria-expanded={open}>
                <b>{String(day.day).padStart(2, "0")}</b>
                <span><small>DÍA {day.day}</small>{day.title}</span>
                <i>+</i>
              </button>
              {open && <div className={styles.itineraryBody}>
                <p>{day.description}</p>
                <div className={styles.itineraryMeta}>
                  {settings?.showTimes && day.startTime && <span><b>Horario</b>{day.startTime}{day.endTime ? ` – ${day.endTime}` : ""}</span>}
                  {settings?.showStops && day.stops?.length ? <span><b>Paradas</b>{[...day.stops].sort((a,b) => a.order - b.order).map((stop) => stop.name).join(" · ")}</span> : null}
                  {settings?.showMeals && day.meals?.length ? <span><b>Alimentos</b>{day.meals.join(" · ")}</span> : null}
                  {settings?.showAccommodation && day.accommodation ? <span><b>Hospedaje</b>{day.accommodation}</span> : null}
                </div>
                {settings?.showHighlights && day.highlights?.length ? <ul>{day.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul> : null}
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
}: {
  trip: TravelProduct;
  departureId: string;
  onDepartureChange: (id: string) => void;
}) {
  const sections = resolveTripSections(trip).filter((section) => section.type !== "related_trips");
  const selected = trip.departures.find((item) => item.id === departureId) ?? trip.departures[0];
  const destinations = getVisitedDestinations(trip.itinerary);
  const video = getSafeVideoPresentation(trip.videoContent);
  return (
    <div className={styles.sections}>
      {sections.map((section) => {
        const title = section.title ?? section.anchorLabel;
        if (section.type === "summary") {
          const price = getTripDisplayStartingPrice({ trip, departure: selected });
          return <section id={section.id} key={section.id} className={styles.summary}>
            <small>ACERCA DEL VIAJE</small><h2>{title}</h2>
            <p>{trip.summaryContent?.shortDescription ?? trip.summary}</p>
            <div className={styles.summaryFacts}>
              <span><b>{formatTripDuration(trip.durationDays, trip.durationNights)}</b><small>Duración</small></span>
              <span><b>{destinations.join(" · ") || trip.cities.join(" · ")}</b><small>Visitando</small></span>
              <span><b>{formatMoney(price.amount, price.currency)}</b><small>{price.label}</small></span>
            </div>
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
        if (section.type === "included") return <section id={section.id} key={section.id}>
          <small>SERVICIOS</small><h2>{title}</h2><div className={styles.includes}>
            <div><h3>Incluye</h3>{(trip.inclusionsContent?.included ?? []).map((item) => <p key={item.id}><FaCheck /> {item.text}</p>)}</div>
            <div><h3>No incluye</h3>{(trip.inclusionsContent?.excluded ?? []).map((item) => <p key={item.id}><FaXmark /> {item.text}</p>)}</div>
          </div>
        </section>;
        if (section.type === "map") return <section id={section.id} key={section.id}>
          <small>RUTA</small><h2>{title}</h2><div className={styles.route}>{getOrderedRouteStops(trip.mapSettings).map((stop) => <span key={stop.id}><b>{stop.dayNumber}</b><i><FaLocationDot /></i>{stop.name}</span>)}</div>
        </section>;
        if (section.type === "departures") return <section id={section.id} key={section.id}>
          <small>FECHAS DISPONIBLES</small><h2>{title}</h2><div className={styles.departures}>{trip.departures.map((item) => {
            const price = getTripDisplayStartingPrice({ trip, departure: item });
            return <button key={item.id} className={item.id === selected.id ? styles.departureActive : undefined} onClick={() => onDepartureChange(item.id)} disabled={item.saleStatus === "sold_out"}>
              <time>{lavellaDate(item.startDate, true)}</time><span>Desde {formatMoney(price.amount, price.currency)}</span><b>{item.saleStatus === "sold_out" ? "Agotada" : item.saleStatus === "limited" ? "Últimos lugares" : "Disponible"}</b>
            </button>;
          })}</div>
        </section>;
        if (section.type === "rates") return <section id={section.id} key={section.id}>
          <small>TARIFAS</small><h2>{title}</h2><div className={styles.rates}>{trip.pricingOptions.map((rate) => <article key={rate.id}><span>{rate.label}</span><strong>{formatMoney(getEffectiveRateAmount({ trip, departure: selected, rate }), rate.currency)}</strong>{rate.occupancy === "double" && <small>Precio de referencia</small>}</article>)}</div>
        </section>;
        if (section.type === "recommendations") return <section id={section.id} key={section.id}>
          <small>ANTES DE VIAJAR</small><h2>{title}</h2><ul className={styles.recommendations}>{getRecommendationItems(trip).map((item) => <li key={item.id}>{item.text}</li>)}</ul>
        </section>;
        if (section.type === "departure_points") return <section id={section.id} key={section.id}>
          <small>PUNTOS DE SALIDA</small><h2>{title}</h2><div className={styles.points}>{getPublicDeparturePoints(trip.publicDeparturePoints).map((point) => <article key={point.id}><b>{point.name}</b><p>{[point.city, point.reference, point.meetingTime].filter(Boolean).join(" · ")}</p></article>)}</div>
        </section>;
        if (section.type === "important_information") return <section id={section.id} key={section.id}>
          <small>INFORMACIÓN IMPORTANTE</small><h2>{title}</h2>{trip.importantInformation?.items.map((item) => <article className={styles.information} key={item.id}><h3>{item.title}</h3><p>{item.description}</p></article>)}
        </section>;
        if (section.type === "faq") return <section id={section.id} key={section.id}>
          <small>PREGUNTAS FRECUENTES</small><h2>{title}</h2><div className={styles.faq}>{trip.faqContent?.items.map((item) => <details key={item.id}><summary>{item.question}<i>+</i></summary><p>{item.answer}</p></details>)}</div>
        </section>;
        return null;
      })}
    </div>
  );
}
