"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaImages, FaXmark } from "react-icons/fa6";
import type { TravelProduct } from "@/types";
import styles from "./lavella-detail.module.css";

const tripImages = (trip: TravelProduct) => {
  const configured = trip.galleryImages?.length
    ? [...trip.galleryImages].sort((a, b) => a.order - b.order)
    : [trip.featuredImage, ...trip.gallery].map((url, index) => ({
        id: `gallery-${index}`,
        url,
        alt: `Vista ${index + 1} de ${trip.title}`,
        caption: "",
        order: index,
      }));
  return configured;
};

export function LavellaTripGallery({ trip }: { trip: TravelProduct }) {
  const images = tripImages(trip);
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const moveRail = (direction: number) =>
    rail.current?.scrollBy({ left: direction * 415, behavior: "smooth" });
  const moveLightbox = (direction: number) =>
    setSelected((current) =>
      current === null
        ? 0
        : (current + direction + images.length) % images.length,
    );
  useEffect(() => {
    if (selected === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [selected, images.length]);
  if (!images.length) return null;
  return (
    <>
      <div className={styles.galleryControls}>
        <button onClick={() => moveRail(-1)} aria-label="Fotografías anteriores">
          <FaArrowLeft />
        </button>
        <button onClick={() => moveRail(1)} aria-label="Fotografías siguientes">
          <FaArrowRight />
        </button>
      </div>
      <div className={styles.heroGallery} ref={rail} aria-label="Galería del viaje">
        {images.map((image, index) => (
          <button
            key={image.id}
            className={styles.heroGalleryItem}
            onClick={() => setSelected(index)}
            aria-label={`Abrir fotografía ${index + 1} de ${images.length}`}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              priority={index < 2}
              sizes="(max-width: 760px) 78vw, 403px"
            />
            <span>
              <FaImages />
              {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div
          className={styles.lightbox}
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${trip.title}`}
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <button className={styles.lightboxClose} onClick={() => setSelected(null)} aria-label="Cerrar galería">
            <FaXmark />
          </button>
          <button className={styles.lightboxPrev} onClick={() => moveLightbox(-1)} aria-label="Fotografía anterior">
            <FaArrowLeft />
          </button>
          <figure>
            <Image
              src={images[selected].url}
              alt={images[selected].alt}
              fill
              sizes="94vw"
            />
            {images[selected].caption && <figcaption>{images[selected].caption}</figcaption>}
          </figure>
          <button className={styles.lightboxNext} onClick={() => moveLightbox(1)} aria-label="Fotografía siguiente">
            <FaArrowRight />
          </button>
        </div>
      )}
    </>
  );
}
