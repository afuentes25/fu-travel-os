"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FaMinus, FaPlus, FaWhatsapp, FaXmark } from "react-icons/fa6";
import {
  explorerAdultRateOccupancy,
  explorerVisibleRateOccupancies,
} from "@/lib/explorer";
import { formatMoney, priceLinePending } from "@/lib/pricing";
import {
  resolveRoomCapacityPolicy,
  validateRoomCapacity,
} from "@/lib/room-capacity";
import {
  createTravelerDrafts,
  draftsFromLines,
  reconcileTravelerDrafts,
} from "@/lib/travelers";
import type {
  Agency,
  CartLine,
  DepositPolicy,
  TravelProduct,
} from "@/types";
import styles from "./lavella-booking.module.css";
import {
  lavellaDate,
  lavellaDeparture,
  lavellaStartingPrice,
  lavellaWhatsApp,
  openLavellaWhatsApp,
} from "./lavella-utils";

const occupancyLabel = (value?: string) =>
  ({
    single: "Sencilla",
    double: "Doble",
    triple: "Triple",
    quadruple: "Cuádruple",
    child: "Menor",
    general: "Adulto",
  })[value ?? ""] ?? "Por confirmar";

const calculateDeposit = (
  policy: DepositPolicy | undefined,
  total: number,
  fallback: number,
) => {
  if (!policy?.enabled) return fallback;
  if (policy.type === "fixed") return Math.max(policy.fixedAmount ?? fallback, policy.minimumAmount ?? 0);
  return Math.max(total * ((policy.percentage ?? 100) / 100), policy.minimumAmount ?? 0);
};

export function LavellaBookingPanel({
  agency,
  trip,
  departureId,
  onDepartureChange,
}: {
  agency: Agency;
  trip: TravelProduct;
  departureId: string;
  onDepartureChange: (id: string) => void;
}) {
  const departure =
    trip.departures.find((item) => item.id === departureId) ??
    lavellaDeparture(trip);
  const [adults, setAdults] = useState(2);
  const [minors, setMinors] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const hotel = trip.accommodationMode === "hotel_occupancy";
  const occupancy = explorerAdultRateOccupancy(trip, adults);
  const adultRate = trip.pricingOptions.find((rate) => rate.occupancy === occupancy);
  const minorRate = trip.pricingOptions.find((rate) => rate.occupancy === "child");
  const policy = resolveRoomCapacityPolicy(agency, trip, adultRate);
  const capacity = validateRoomCapacity({
    adults,
    minors,
    maxGuestsPerRoom: policy.defaultMaxGuestsPerRoom,
    adultCountsTowardCapacity: policy.adultCountsTowardCapacity,
    minorCountsTowardCapacity: policy.minorCountsTowardCapacity,
    infantCountsTowardCapacity: policy.infantCountsTowardCapacity,
  });
  const capacityApplies = hotel && policy.enabled;
  const capacityValid = !capacityApplies || capacity.valid;
  const adultLine: CartLine | undefined = adultRate
    ? {
        id: `line-${trip.id}-adultos`,
        agencyId: agency.id,
        travelId: trip.id,
        departureId: departure.id,
        boardingOptionId: null,
        pricingOptionId: adultRate.id,
        travelers: adults,
        extraIds: [],
        travelerDataStatus: "pending",
        travelerDrafts: createTravelerDrafts(adults, 0, `${trip.id}-${departure.id}`),
      }
    : undefined;
  const minorLine: CartLine | undefined =
    minors && minorRate
      ? {
          id: `line-${trip.id}-menores`,
          agencyId: agency.id,
          travelId: trip.id,
          departureId: departure.id,
          boardingOptionId: null,
          pricingOptionId: minorRate.id,
          travelers: minors,
          extraIds: [],
          travelerDataStatus: "pending",
          travelerDrafts: createTravelerDrafts(0, minors, `${trip.id}-${departure.id}`),
        }
      : undefined;
  let adultPrice: ReturnType<typeof priceLinePending> | undefined;
  let minorPrice: ReturnType<typeof priceLinePending> | undefined;
  try {
    if (adultLine) adultPrice = priceLinePending(adultLine);
    if (minorLine) minorPrice = priceLinePending(minorLine);
  } catch {
    adultPrice = undefined;
    minorPrice = undefined;
  }
  const subtotal = (adultPrice?.subtotal ?? 0) + (minorPrice?.subtotal ?? 0);
  const taxes = (adultPrice?.taxes ?? 0) + (minorPrice?.taxes ?? 0);
  const charges =
    (adultPrice?.extrasTotal ?? 0) + (minorPrice?.extrasTotal ?? 0);
  const total = (adultPrice?.total ?? 0) + (minorPrice?.total ?? 0);
  const deposit = calculateDeposit(
    departure.depositPolicy ?? trip.depositPolicy,
    total,
    (adultPrice?.deposit ?? 0) + (minorPrice?.deposit ?? 0),
  );
  const canReserve = Boolean(
    adultPrice &&
      (!hotel || (occupancy && adults <= 4)) &&
      (!minors || minorPrice) &&
      capacityValid,
  );
  const starting = lavellaStartingPrice(trip, departure);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const hero = document.querySelector("[data-lavella-detail-hero]");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileBar(!entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(false);
      if (event.key !== "Tab" || !sheetRef.current) return;
      const controls = [...sheetRef.current.querySelectorAll<HTMLElement>(
        "button,a[href],input,select",
      )].filter((item) => !item.hasAttribute("disabled"));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [sheet]);
  const reserve = () => {
    if (!canReserve || !adultLine) return;
    const existing = JSON.parse(
      localStorage.getItem("fu-travel-demo-cart") ?? "[]",
    ) as CartLine[];
    if (existing.length && existing[0].agencyId !== agency.id) {
      window.alert("El carrito pertenece a otra agencia.");
      return;
    }
    const previousLines = existing.filter(
      (line) => line.travelId === trip.id && line.departureId === departure.id,
    );
    const reconciled = reconcileTravelerDrafts({
      drafts: draftsFromLines(previousLines),
      adults,
      minors,
      scope: `${trip.id}-${departure.id}`,
      confirmDiscard: true,
    });
    const nextLines = [adultLine, minorLine]
      .filter(Boolean)
      .map((line) => ({
        ...line!,
        travelerDataStatus: previousLines[0]?.travelerDataStatus ?? "pending",
        travelerDrafts: reconciled.drafts.filter(
          (draft) =>
            draft.category ===
            (line!.id.endsWith("-menores") ? "minor" : "adult"),
        ),
      })) as CartLine[];
    localStorage.setItem(
      "fu-travel-demo-cart",
      JSON.stringify([
        ...existing.filter((line) => !line.id.startsWith(`line-${trip.id}-`)),
        ...nextLines,
      ]),
    );
    localStorage.setItem(
      "fu-travel-booking-draft",
      JSON.stringify({
        travelId: trip.id,
        departureId: departure.id,
        adults,
        children: minors,
        ...(hotel && occupancy ? { occupancy } : {}),
        total,
        deposit,
      }),
    );
    window.location.assign(`/carrito${window.location.search}`);
  };
  const message = [
    `Hola ${agency.name}, estoy interesado en “${trip.title}”.`,
    `Fecha: ${lavellaDate(departure.startDate, true)}`,
    `Adultos: ${adults}`,
    minors ? `Menores: ${minors}` : "",
    hotel && occupancy ? `Base: ${occupancyLabel(occupancy)}` : "",
    capacityApplies && !capacity.valid
      ? `Somos ${capacity.totalCountedGuests} personas y la capacidad máxima es ${policy.defaultMaxGuestsPerRoom}. ¿Me ayudan a cotizar más habitaciones?`
      : "¿Me pueden compartir los puntos de ascenso disponibles?",
    total ? `Total estimado: ${formatMoney(total, trip.basePrice.currency)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fields = (
    <>
      <div className={styles.bookingVisual}>
        <Image src={trip.featuredImage} alt="" fill sizes="400px" />
        <div>
          <span>★★★★★</span>
          <h2>{trip.title}</h2>
          <p>
            {trip.durationDays} {trip.durationDays === 1 ? "día" : "días"}
            {trip.durationNights > 0
              ? ` · ${trip.durationNights} ${trip.durationNights === 1 ? "noche" : "noches"}`
              : ""}
          </p>
        </div>
      </div>
      <div className={styles.bookingBody}>
      <header className={styles.bookingHead}>
        <span><small>DESDE</small><strong>{formatMoney(starting.amount, starting.currency)}</strong></span>
        <span><small>ANTICIPO</small><b>{formatMoney(deposit, trip.basePrice.currency)}</b></span>
      </header>
      <label className={styles.bookingField}>
        Fecha de salida
        <select value={departure.id} onChange={(event) => onDepartureChange(event.target.value)}>
          {trip.departures.map((item) => (
            <option key={item.id} value={item.id} disabled={item.saleStatus === "sold_out"}>
              {lavellaDate(item.startDate, true)} · {item.saleStatus === "sold_out" ? "Agotada" : "Programada"}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.travelerRows}>
        {([
          { label: "Adultos", value: adults, note: "12 años en adelante", minus: () => setAdults((value) => Math.max(1, value - 1)), plus: () => setAdults((value) => Math.min(hotel ? 5 : 8, value + 1)) },
          { label: "Menores", value: minors, note: "3 a 11 años", minus: () => setMinors((value) => Math.max(0, value - 1)), plus: () => setMinors((value) => Math.min(4, value + 1)) },
        ] as const).map(({ label, value, note, minus, plus }) => (
          <div key={label}>
            <span><b>{label}</b><small>{note}</small></span>
            <span>
              <button onClick={minus} aria-label={`Quitar ${label.toLowerCase()}`}><FaMinus /></button>
              <b>{value}</b>
              <button onClick={plus} aria-label={`Agregar ${label.toLowerCase()}`}><FaPlus /></button>
            </span>
          </div>
        ))}
      </div>
      {hotel && (
        <div className={styles.occupancyLine}>
          <span><small>BASE DE OCUPACIÓN</small><b>{occupancyLabel(occupancy)}</b></span>
          <span><small>CAPACIDAD</small><b>{capacity.totalCountedGuests} / {policy.defaultMaxGuestsPerRoom}</b></span>
        </div>
      )}
      {capacityApplies && !capacity.valid && (
        <p className={styles.capacityAlert} role="alert">
          Máximo {policy.defaultMaxGuestsPerRoom} personas por habitación. Ajusta viajeros o consulta más habitaciones.
        </p>
      )}
      <footer className={styles.bookingFooter}>
        {taxes > 0 && <span><small>Subtotal</small><b>{formatMoney(subtotal, trip.basePrice.currency)}</b></span>}
        {taxes > 0 && <span><small>{trip.basePrice.taxesLabel ?? "Impuestos"}</small><b>{formatMoney(taxes, trip.basePrice.currency)}</b></span>}
        {charges > 0 && <span><small>Cargos</small><b>{formatMoney(charges, trip.basePrice.currency)}</b></span>}
        <strong><span>Total</span><b>{canReserve ? formatMoney(total, trip.basePrice.currency) : "Por confirmar"}</b></strong>
        <small>{trip.basePrice.taxesIncluded ? "Impuestos incluidos" : taxes ? "Impuestos desglosados" : "Impuestos por confirmar"}</small>
        <button disabled={!canReserve} onClick={reserve}>
          {capacityValid ? "Reservar ahora" : "Ajusta viajeros"}
        </button>
        {mounted && (
          <a
            href={lavellaWhatsApp(agency, trip, message)}
            onClick={(event) => openLavellaWhatsApp(event, agency, trip, message)}
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp /> Consultar por WhatsApp
          </a>
        )}
      </footer>
      </div>
    </>
  );
  return (
    <>
      <aside className={styles.bookingPanel} aria-label="Configurar reserva">
        {fields}
      </aside>
      <div className={`${styles.mobileBookingBar} ${showMobileBar ? styles.mobileBookingBarVisible : ""}`}>
        <span><small>Desde</small><b>{formatMoney(starting.amount, starting.currency)}</b></span>
        <button ref={triggerRef} onClick={() => setSheet(true)} aria-haspopup="dialog">Reservar</button>
        {mounted && (
          <a
            href={lavellaWhatsApp(agency, trip, message)}
            onClick={(event) => openLavellaWhatsApp(event, agency, trip, message)}
            target="_blank"
            rel="noreferrer"
            aria-label="Consultar por WhatsApp"
          >
            <FaWhatsapp />
          </a>
        )}
      </div>
      {sheet && (
        <div className={styles.sheetBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setSheet(false)}>
          <div ref={sheetRef} className={styles.bookingSheet} role="dialog" aria-modal="true" aria-label="Configurar reserva">
            <header><b>Configura tu reserva</b><button onClick={() => setSheet(false)} aria-label="Cerrar reserva"><FaXmark /></button></header>
            <div className={styles.bookingSheetScroll}>{fields}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function LavellaRateOccupancies({ trip }: { trip: TravelProduct }) {
  return explorerVisibleRateOccupancies(trip);
}
