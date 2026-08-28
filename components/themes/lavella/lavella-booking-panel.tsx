"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FaMinus, FaPlus, FaWhatsapp, FaXmark } from "react-icons/fa6";
import {
  explorerAdultRateOccupancy,
  explorerVisibleRateOccupancies,
} from "@/lib/explorer";
import {
  createDeterministicDemoPaymentQuote,
  formatAppliedRate,
  formatFxMarkup,
  formatMinorUnits,
  formatSourceRate,
  toMinorUnits,
} from "@/lib/fx";
import {
  formatMoney,
  isDepartureBookable,
} from "@/lib/pricing";
import {
  resolveRoomCapacityPolicy,
  validateRoomCapacity,
} from "@/lib/room-capacity";
import {
  createTravelerDraftAttemptScope,
  createTravelerDrafts,
} from "@/lib/travelers";
import type {
  Agency,
  CartLine,
  FxSnapshot,
  PaymentAllocation,
  TravelProduct,
} from "@/types";
import styles from "./lavella-booking.module.css";
import {
  createLavellaCartTransition,
  getLavellaBookingQuote,
  updateLavellaTravelerCounts,
} from "./lavella-booking-cart";
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

const detailProductLabel = (value: TravelProduct["productType"]) =>
  value === "excursion"
    ? "Tour"
    : value === "circuit"
      ? "Circuito"
      : value.replaceAll("_", " ");

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
  const [travelerCounts, setTravelerCounts] = useState({
    adults: 2,
    minors: 0,
  });
  const [sheet, setSheet] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fxSnapshot, setFxSnapshot] = useState<FxSnapshot>();
  const [paymentAllocation, setPaymentAllocation] = useState<PaymentAllocation>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const reservingRef = useRef(false);
  const hotel = trip.accommodationMode === "hotel_occupancy";
  const { adults, minors } = travelerCounts;
  const changeTravelerCount = (
    category: "adults" | "minors",
    direction: -1 | 1,
  ) => {
    setTravelerCounts((current) =>
      updateLavellaTravelerCounts({ current, category, direction, hotel }),
    );
  };
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
  let quote: ReturnType<typeof getLavellaBookingQuote> | undefined;
  try {
    const lines = [adultLine, minorLine].filter(Boolean) as CartLine[];
    if (adultLine)
      quote = getLavellaBookingQuote({
        trip,
        departureId: departure.id,
        lines,
      });
  } catch {
    quote = undefined;
  }
  const subtotal = quote?.subtotal ?? 0;
  const taxes = quote?.taxes ?? 0;
  const charges = quote?.charges ?? 0;
  const total = quote?.total ?? 0;
  const starting = lavellaStartingPrice(trip, departure);
  const deposit = quote?.deposit ?? 0;
  const fxPolicy = agency.settings.exchangeRatePolicy;
  const foreignPricing = trip.foreignCurrencyPricing;
  const fxEnabled = Boolean(
    fxPolicy?.enabled &&
      foreignPricing?.convertDepositAtCheckout &&
      foreignPricing.pricingCurrency !== foreignPricing.checkoutChargeCurrency,
  );
  const canReserve = Boolean(
    quote &&
      (!hotel || (occupancy && adults <= 4)) &&
      (!minors || minorLine) &&
      capacityValid &&
      isDepartureBookable(departure) &&
      (!fxEnabled || (fxSnapshot && paymentAllocation)),
  );
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let cancelled = false;
    if (!fxEnabled || !fxPolicy || !foreignPricing || !total || !deposit) {
      setFxSnapshot(undefined);
      setPaymentAllocation(undefined);
      return;
    }
    createDeterministicDemoPaymentQuote({
      policy: fxPolicy,
      sourceCurrency: foreignPricing.pricingCurrency,
      chargeCurrency: foreignPricing.checkoutChargeCurrency,
      contractTotalMinor: toMinorUnits(total, foreignPricing.pricingCurrency),
      contractualPaymentMinor: toMinorUnits(
        deposit,
        foreignPricing.pricingCurrency,
      ),
      kind: "deposit",
    })
      .then(({ snapshot, allocation }) => {
        if (cancelled) return;
        setFxSnapshot(snapshot);
        setPaymentAllocation(allocation);
      })
      .catch(() => {
        if (!cancelled) {
          setFxSnapshot(undefined);
          setPaymentAllocation(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deposit, foreignPricing, fxEnabled, fxPolicy, total]);
  useEffect(() => {
    const hero = document.querySelector("[data-lavella-detail-hero]");
    if (!hero) return;
    const footer = document.querySelector(
      'footer[data-lavella-surface="dark"]',
    );
    const isVisible = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight;
    };
    let heroVisible = isVisible(hero);
    let footerVisible = footer ? isVisible(footer) : false;
    const updateBar = () => setShowMobileBar(!heroVisible && !footerVisible);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === hero) heroVisible = entry.isIntersecting;
          if (entry.target === footer) footerVisible = entry.isIntersecting;
        });
        updateBar();
      },
      { threshold: 0.01, rootMargin: "0px 0px 72px 0px" },
    );
    observer.observe(hero);
    if (footer) observer.observe(footer);
    updateBar();
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
    if (!canReserve || !adultLine || reservingRef.current) return;
    reservingRef.current = true;
    try {
      const existing = JSON.parse(
        localStorage.getItem("fu-travel-demo-cart") ?? "[]",
      ) as CartLine[];
      const freshDrafts = createTravelerDrafts(
        adults,
        minors,
        createTravelerDraftAttemptScope(trip.id, departure.id),
      );
      const nextLines = [adultLine, minorLine]
        .filter(Boolean)
        .map((line) => ({
          ...line!,
          ...(fxSnapshot ? { fxSnapshot } : {}),
          ...(paymentAllocation ? { paymentAllocation } : {}),
          travelerDataStatus: "pending",
          travelerDrafts: freshDrafts.filter(
            (draft) =>
              draft.category ===
              (line!.id.endsWith("-menores") ? "minor" : "adult"),
          ),
        })) as CartLine[];
      const transition = createLavellaCartTransition({
        agency,
        trip,
        departureId: departure.id,
        adults,
        minors,
        occupancy,
        incomingLines: nextLines,
        existingCart: existing,
        search: window.location.search,
      });
      localStorage.setItem(
        "fu-travel-demo-cart",
        JSON.stringify(transition.cart),
      );
      localStorage.setItem(
        "fu-travel-booking-draft",
        JSON.stringify({
          ...transition.draft,
          ...(fxSnapshot ? { fxSnapshot } : {}),
          ...(paymentAllocation ? { paymentAllocation } : {}),
        }),
      );
      window.location.assign(transition.href);
    } catch (error) {
      reservingRef.current = false;
      window.alert(
        error instanceof Error
          ? error.message
          : "No fue posible agregar el viaje al carrito.",
      );
    }
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
    fxSnapshot && paymentAllocation
      ? `Anticipo contractual: ${formatMinorUnits(paymentAllocation.contractualPaymentMinor, paymentAllocation.contractCurrency)} · Cobro demo: ${formatMinorUnits(paymentAllocation.chargeNowMinor, paymentAllocation.chargeCurrency)}`
      : "",
    fxSnapshot
      ? `Tasa demo aplicada: ${formatAppliedRate(fxSnapshot)} MXN por USD`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const mobileIdentity = (
    <div className={styles.bookingVisual}>
      <Image src={trip.featuredImage} alt="" fill sizes="400px" />
      <div>
        <span>{detailProductLabel(trip.productType).toUpperCase()}</span>
        <h2>{trip.title}</h2>
        <p>
          {trip.durationDays} {trip.durationDays === 1 ? "día" : "días"}
          {trip.durationNights > 0
            ? ` · ${trip.durationNights} ${trip.durationNights === 1 ? "noche" : "noches"}`
            : ""}
        </p>
      </div>
    </div>
  );
  const fields = (
      <div className={styles.bookingBody}>
      <header className={styles.bookingHead}>
        <span><small>ANTICIPO</small><b>{formatMoney(deposit, trip.basePrice.currency)}</b></span>
      </header>
      <label className={styles.bookingField}>
        Fecha de salida
        <select value={departure.id} onChange={(event) => onDepartureChange(event.target.value)}>
          {trip.departures.map((item) => (
            <option key={item.id} value={item.id} disabled={!isDepartureBookable(item)}>
              {lavellaDate(item.startDate, true)} · {!isDepartureBookable(item) ? "Finalizada" : "Programada"}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.travelerRows}>
        {([
          { label: "Adultos", category: "adults", value: adults, note: "12 años en adelante" },
          { label: "Menores", category: "minors", value: minors, note: "3 a 11 años" },
        ] as const).map(({ label, category, value, note }) => (
          <div key={label}>
            <span><b>{label}</b><small>{note}</small></span>
            <span>
              <button type="button" onClick={() => changeTravelerCount(category, -1)} aria-label={`Quitar ${label.toLowerCase()}`}><FaMinus /></button>
              <b>{value}</b>
              <button type="button" onClick={() => changeTravelerCount(category, 1)} aria-label={`Agregar ${label.toLowerCase()}`}><FaPlus /></button>
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
        {fxSnapshot && paymentAllocation && (
          <div className={styles.fxEstimate} role="note">
            <span><small>Anticipo contractual</small><b>{formatMinorUnits(paymentAllocation.contractualPaymentMinor, paymentAllocation.contractCurrency)}</b></span>
            <span><small>Estimado de cobro hoy</small><b>{formatMinorUnits(paymentAllocation.chargeNowMinor, paymentAllocation.chargeCurrency)}</b></span>
            <p>Tasa fuente demo {formatSourceRate(fxSnapshot)} + margen {formatFxMarkup(fxSnapshot)} · aplicada {formatAppliedRate(fxSnapshot)} MXN/USD. El saldo de {formatMinorUnits(paymentAllocation.remainingContractMinor, paymentAllocation.contractCurrency)} permanece en USD.</p>
          </div>
        )}
        <button disabled={!canReserve} onClick={reserve}>
          {!capacityValid ? "Ajusta viajeros" : fxEnabled && !fxSnapshot ? "Calculando tasa…" : "Reservar ahora"}
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
  );
  return (
    <>
      <aside
        className={styles.bookingPanel}
        aria-label="Configurar reserva"
        data-lavella-surface="light"
      >
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
          <div
            ref={sheetRef}
            className={styles.bookingSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Configurar reserva"
            data-lavella-surface="light"
          >
            <header><b>Configura tu reserva</b><button onClick={() => setSheet(false)} aria-label="Cerrar reserva"><FaXmark /></button></header>
            <div className={styles.bookingSheetScroll}>
              {mobileIdentity}
              {fields}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LavellaRateOccupancies({ trip }: { trip: TravelProduct }) {
  return explorerVisibleRateOccupancies(trip);
}
