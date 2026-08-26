"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import type { IconType } from "react-icons";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { agencies, destinations, travels } from "@/data/demo";
import {
  filterCatalog,
  type CatalogFilters,
} from "@/lib/catalog";
import {
  EXPLORER_SLIDER_LABELS,
  explorerAdultRateOccupancy,
  explorerBookingMessage,
  explorerSlideIndex,
  explorerVisibleRateOccupancies,
} from "@/lib/explorer";
import {
  formatMoney,
  isDepartureBookable,
  priceLinePending,
} from "@/lib/pricing";
import {
  resolveRoomCapacityPolicy,
  validateRoomCapacity,
} from "@/lib/room-capacity";
import { getAgencySocialLinks } from "@/lib/social";
import { resolveTenant, resolveTheme } from "@/lib/tenancy";
import {
  createTravelerDrafts,
  draftsFromLines,
  reconcileTravelerDrafts,
} from "@/lib/travelers";
import {
  formatTripDuration,
  getEffectiveRateAmount,
  getInitialItineraryOpenDays,
  getOrderedRouteStops,
  getPublicDeparturePoints,
  getRecommendationItems,
  getSafeVideoPresentation,
  getStickyTripSections,
  getTripDisplayStartingPrice,
  getVisitedDestinations,
  isSafeDownloadUrl,
  localItineraryLeadCaptureService,
  resolveTripSections,
  validateLead,
} from "@/lib/trip-sections";
import type {
  Agency,
  AvailabilityDisplayMode,
  BookingBoardingSnapshot,
  CartLine,
  DepositPolicy,
  SocialNetwork,
  TravelProduct,
  TravelTheme,
  TripSectionConfig,
} from "@/types";
import { TravelApp as LegacyTravelApp } from "./legacy-travel-app";
import { CustomerAuthModal, type CustomerAuthMode } from "@/app/cuenta/customer-auth-modal";
import type { PublicCustomerCheckoutProfile } from "@/lib/customers/public-customer-identity";
import {
  LavellaFooter,
  LavellaHeader,
  LavellaHome,
  LavellaCatalog,
  LavellaTripDetail,
} from "./themes/lavella/lavella-theme";

type OpenTrip = (trip: TravelProduct) => void;
type HeaderProps = {
  agency: Agency;
  cartCount: number;
  onNavigate: (path: string) => void;
  customerEmail?: string | null;
};
type HomeProps = {
  agency: Agency;
  trips: TravelProduct[];
  onOpen: OpenTrip;
  onNavigate: (path: string) => void;
};
type CardProps = { trip: TravelProduct; onOpen: OpenTrip };
type FooterProps = { agency: Agency; onNavigate: (path: string) => void };
type ThemeComponents = {
  Header: ComponentType<HeaderProps>;
  Home: ComponentType<HomeProps>;
  Footer: ComponentType<FooterProps>;
};

const heroImages: Record<TravelTheme, string> = {
  explorer: "/images/explorer-hero.webp",
  lavella: "/images/explorer-hero.webp",
};
const navItems = ["Viajes", "Destinos", "Promociones", "Nosotros", "Contacto"];
const currentPath = () =>
  typeof window === "undefined" ? "/" : window.location.pathname;
const currentParams = () =>
  typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
const dateLabel = (date: string, long = false) =>
  new Date(date).toLocaleDateString(
    "es-MX",
    long
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "2-digit", month: "short" },
  );
const explorerPrice = (amount: number, currency: "MXN" | "USD") =>
  formatMoney(amount, currency).replace(/^USD\s*/u, "$");
const transportLabel = (value: TravelProduct["transportTypes"][number]) =>
  ({
    ground: "Terrestre",
    air: "Aéreo",
    cruise: "Crucero",
    train: "Tren",
    mixed: "Mixto",
    not_included: "No incluido",
  })[value];
const productLabel = (value: TravelProduct["productType"]) =>
  ({
    day_tour: "Excursión de un día",
    excursion: "Excursión",
    short_break: "Escapada",
    circuit: "Circuito",
    vacation_package: "Paquete vacacional",
    beach: "Playa",
    magical_town: "Pueblo mágico",
    cruise: "Crucero",
    experience: "Experiencia",
    group_trip: "Viaje en grupo",
    custom_trip: "Viaje personalizado",
  })[value];
const travelUrl = (trip: TravelProduct) => `/viajes/${trip.slug}`;
const available = (trip: TravelProduct) =>
  trip.departures.find(
    (departure) =>
      isDepartureBookable(departure) && departure.availableSpaces > 0,
  ) ?? trip.departures[0];
const availabilityMode = (
  agency: Agency,
  trip: TravelProduct,
): AvailabilityDisplayMode =>
  trip.availabilityDisplayMode ??
  agency.settings.availabilityDisplayMode ??
  "status_only";
const occupancyName = (occupancy?: string) =>
  ({
    single: "Sencilla",
    double: "Doble",
    triple: "Triple",
    quadruple: "Cuádruple",
    child: "Menor",
    infant: "Infante",
    general: "General",
  })[occupancy ?? ""] ?? "Por confirmar";
const depositAmount = (
  policy: DepositPolicy | undefined,
  total: number,
  fallback: number,
  travelers = 1,
) => {
  if (!policy?.enabled) return fallback;
  const calculated =
    policy.type === "percentage"
      ? total * ((policy.percentage ?? 0) / 100)
      : (policy.fixedAmount ?? fallback) * travelers;
  return Math.max(policy.minimumAmount ?? 0, calculated);
};
const whatsappLink = (phone: string, message: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
const socialIcons: Record<SocialNetwork, IconType> = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  linkedin: FaLinkedinIn,
  x: FaXTwitter,
  whatsapp: FaWhatsapp,
};
const socialNames: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  whatsapp: "WhatsApp",
};

function ExplorerSocialLinks({
  agency,
  placement,
  drawer = false,
}: {
  agency: Agency;
  placement: "header" | "footer";
  drawer?: boolean;
}) {
  const links = getAgencySocialLinks(agency, placement);
  if (!links.length) return null;
  return (
    <div
      className={`explorer-social-links ${drawer ? "is-drawer" : ""}`}
      aria-label={`Redes sociales de ${agency.name}`}
    >
      {links.map((link) => {
        const Icon = socialIcons[link.network];
        const name = link.label ?? socialNames[link.network];
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visitar ${name} de ${agency.name}`}
            title={name}
          >
            <Icon aria-hidden="true" focusable="false" />
          </a>
        );
      })}
    </div>
  );
}

function ExplorerWhatsApp({
  agency,
  trip,
  hidden = false,
}: {
  agency: Agency;
  trip?: TravelProduct;
  hidden?: boolean;
}) {
  const [page, setPage] = useState({ title: "", url: "" });
  const [mobile, setMobile] = useState(false);
  const [draft, setDraft] = useState<{
    travelId: string;
    departureId: string;
    adults: number;
    children: number;
    occupancy?: string;
    total: number;
    deposit: number;
    folio?: string;
    boarding?: BookingBoardingSnapshot;
  } | null>(null);
  useEffect(() => {
    setPage({ title: document.title, url: window.location.href });
    try {
      setDraft(
        JSON.parse(localStorage.getItem("fu-travel-booking-draft") ?? "null"),
      );
    } catch {
      setDraft(null);
    }
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const settings = agency.settings.whatsapp;
  if (
    !settings?.enabled ||
    hidden ||
    (mobile && settings.showOnMobile === false) ||
    (!mobile && settings.showOnDesktop === false)
  )
    return null;
  const draftTrip = draft
    ? travels.find(
        (item) => item.id === draft.travelId && item.agencyId === agency.id,
      )
    : undefined;
  const draftDeparture = draftTrip?.departures.find(
    (item) => item.id === draft?.departureId,
  );
  const message =
    draft && draftTrip && draftDeparture
      ? `Hola ${agency.name}, necesito ayuda con mi reserva de “${draftTrip.title}”.\n\nSalida: ${dateLabel(draftDeparture.startDate, true)}.\nAdultos: ${draft.adults}.${draft.children ? `\nMenores: ${draft.children}.` : ""}${draftTrip.accommodationMode === "hotel_occupancy" && draft.occupancy ? `\nBase de ocupación: ${occupancyName(draft.occupancy)}.` : ""}${draft.boarding ? `\nPunto de abordaje: ${draft.boarding.pointName}.${draft.boarding.meetingTime ? `\nHora de reunión: ${draft.boarding.meetingTime}.` : ""}` : "\n¿Me pueden compartir o confirmar los puntos de ascenso disponibles?"}\nTotal: ${explorerPrice(draft.total, draftTrip.basePrice.currency)}.\nAnticipo: ${explorerPrice(draft.deposit, draftTrip.basePrice.currency)}.${draft.folio ? `\nFolio: ${draft.folio}.` : ""}\n\nEnlace:\n${page.url}`
      : trip
        ? `Hola ${agency.name}, estoy revisando el viaje “${trip.title}” y necesito ayuda para reservar.\n\n¿Me pueden compartir los puntos de ascenso disponibles?\n\nEnlace:\n${page.url}`
        : `Hola ${agency.name}, acabo de visitar la página “${page.title}” y necesito ayuda para reservar.\n\n${settings.defaultMessage ? `${settings.defaultMessage}\n\n` : ""}Aquí está el enlace que visité:\n${page.url}`;
  return (
    <a
      className="explorer-whatsapp-float"
      href={whatsappLink(settings.phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      title={`Contactar por WhatsApp con ${agency.name}`}
    >
      <FaWhatsapp aria-hidden="true" focusable="false" />
    </a>
  );
}

function Logo({ agency, light = false }: { agency: Agency; light?: boolean }) {
  return (
    <span className={`v2-logo ${light ? "is-light" : ""}`}>
      <span className="v2-logo-symbol">F</span>
      <span>
        {agency.branding.logoText}
        <small>{agency.theme === "explorer" ? "VIAJES Y EXPERIENCIAS" : "TRAVEL STUDIO"}</small>
      </span>
    </span>
  );
}

export function ExplorerHeader({ agency, cartCount, onNavigate, customerEmail }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<CustomerAuthMode>("login");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [
        ...drawerRef.current.querySelectorAll<HTMLElement>("button,a[href]"),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      triggerRef.current?.focus();
    };
  }, [open]);
  const go = (path: string) => {
    setOpen(false);
    onNavigate(path);
  };
  return (
    <>
    <header
      className={`explorer-header ${scrolled ? "is-scrolled" : ""} ${open ? "is-menu-open" : ""}`}
    >
      <button onClick={() => onNavigate("/")} aria-label="Inicio">
        <Logo agency={agency} light />
      </button>
      <nav aria-label="Navegación principal Explorer">
        {[
          "Viajes",
          "Próximas salidas",
          "Destinos",
          "Promociones",
          "Nosotros",
        ].map((item) => (
          <button
            key={item}
            onClick={() => onNavigate(`/${item.toLowerCase()}`)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="explorer-header-actions">
        <ExplorerSocialLinks agency={agency} placement="header" />
        <button className="outline-cta" onClick={() => onNavigate("/viajes")}>
          Explorar viajes ↗
        </button>
        <button
          className="v2-cart"
          onClick={() => onNavigate("/carrito")}
          aria-label={`Carrito, ${cartCount} viajes`}
        >
          Carrito <b>{cartCount}</b>
        </button>
        {customerEmail ? (
          <Link className="outline-cta explorer-account-button" href="/cuenta">Mi cuenta</Link>
        ) : (
          <button className="outline-cta explorer-account-button" type="button" onClick={() => { setAuthMode("login"); setAccountOpen(true); }}>Mi cuenta</button>
        )}
        <button
          ref={triggerRef}
          className="v2-menu explorer-menu-trigger"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="explorer-mobile-menu"
        >
          Menú
        </button>
      </div>
      {open && (
        <div
          id="explorer-mobile-menu"
          className="explorer-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú Explorer"
        >
          <header>
            <Logo agency={agency} light />
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú">
              ×
            </button>
          </header>
          <nav aria-label="Menú móvil Explorer">
            {[
              "Viajes",
              "Próximas salidas",
              "Destinos",
              "Promociones",
              "Nosotros",
              "Contacto",
            ].map((item, index) => (
            <button key={item} onClick={() => go(`/${item.toLowerCase()}`)}>
                <small>0{index + 1}</small>
                {item}
                <span>↗</span>
            </button>
          ))}
            {customerEmail ? (
              <Link href="/cuenta"><small>07</small>Mi cuenta<span>↗</span></Link>
            ) : (
              <button onClick={() => { setOpen(false); setAuthMode("login"); setAccountOpen(true); }}><small>07</small>Mi cuenta<span>↗</span></button>
            )}
            <button onClick={() => go("/carrito")}>
              <small>08</small>Carrito ({cartCount})<span>↗</span>
            </button>
            <a
              href={`https://wa.me/${agency.contact.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <small>09</small>WhatsApp<span>↗</span>
            </a>
          </nav>
          <section className="explorer-drawer-social">
            <span>Síguenos</span>
            <ExplorerSocialLinks agency={agency} placement="header" drawer />
          </section>
          <button
            className="explorer-drawer-feature"
            onClick={() => go("/viajes/barrancas-del-cobre")}
          >
            <Image
              src="/images/destination-canyon.webp"
              alt=""
              fill
              sizes="100vw"
            />
            <span>
              RUTA DESTACADA <b>Barrancas del Cobre</b>
            </span>
          </button>
        </div>
      )}
    </header>
    <CustomerAuthModal open={accountOpen} mode={authMode} next="/cuenta" onClose={() => setAccountOpen(false)} onModeChange={setAuthMode} />
    </>
  );
}

function ExplorerCard({ trip, onOpen }: CardProps) {
  const departure = available(trip);
  const agency = agencies.find((item) => item.id === trip.agencyId)!;
  const mode = availabilityMode(agency, trip);
  const availability =
    departure.saleStatus === "sold_out"
      ? "Agotado"
      : departure.saleStatus === "limited"
        ? "Últimos lugares"
        : "Disponible";
  return (
    <article className="explorer-card">
      <Image
        src={trip.featuredImage}
        alt=""
        fill
        sizes="(max-width: 720px) 100vw, 40vw"
      />
      <div className="explorer-card-shade" />
      <div className="explorer-card-top">
        {trip.promotion && <span>{trip.promotion}</span>}
        <small>
          {trip.durationDays} DÍAS · {transportLabel(trip.transportTypes[0])}
        </small>
      </div>
      <button className="explorer-card-body" onClick={() => onOpen(trip)}>
        <span>
          {trip.cities[0]} · {trip.countries[0]}
        </span>
        <h3>{trip.title}</h3>
        <p>{trip.summary}</p>
        <div className="explorer-card-meta">
          <span>{trip.durationDays} días</span>
          <span>{transportLabel(trip.transportTypes[0])}</span>
          <span>{dateLabel(departure.startDate)}</span>
          {mode === "status_only" && <span>{availability}</span>}
          {mode === "remaining_places" && (
            <span>{departure.availableSpaces} lugares disponibles</span>
          )}
        </div>
        <div className="explorer-card-commercial">
          <span>
            <small>{trip.basePrice.displayFrom ? "Desde" : "Precio"}</small>
            <b>
              {explorerPrice(trip.basePrice.amount, trip.basePrice.currency)}
            </b>
          </span>
          <em>Ver más</em>
        </div>
      </button>
    </article>
  );
}

function ExplorerSearch({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [destination, setDestination] = useState("");
  return (
    <form
      className="explorer-search"
      onSubmit={(event) => {
        event.preventDefault();
        onNavigate(`/viajes?q=${encodeURIComponent(destination)}`);
      }}
    >
      <label>
        <span>Destino</span>
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="¿A dónde quieres escapar?"
        />
      </label>
      <label>
        <span>Tipo de aventura</span>
        <select>
          <option>Explorar todo</option>
          <option>Fin de semana</option>
          <option>Playa</option>
          <option>Montaña</option>
        </select>
      </label>
      <label>
        <span>Fecha o mes</span>
        <select>
          <option>Agosto — octubre</option>
          <option>Noviembre</option>
          <option>Diciembre</option>
        </select>
      </label>
      <button>
        Buscar rutas <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}

function ExplorerHome({ agency, trips, onOpen, onNavigate }: HomeProps) {
  const places = destinations
    .filter((item) => item.agencyId === agency.id)
    .slice(0, 5);
  const slides = trips.slice(0, 4);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const active = slides[slide];
  const departure = available(active);
  const pauseTemporarily = () => {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 9000);
  };
  const next = () => {
    pauseTemporarily();
    setSlide((current) => explorerSlideIndex(current, 1, slides.length));
  };
  const previous = () => {
    pauseTemporarily();
    setSlide((current) => explorerSlideIndex(current, -1, slides.length));
  };
  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const timer = window.setInterval(() => {
      if (!document.hidden)
        setSlide((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);
  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );
  const categories = [
    ["Fin de semana", "Escapadas breves", "/images/destination-town.webp"],
    [
      "Pueblos mágicos",
      "Calles con historia",
      "/images/destination-europe.webp",
    ],
    ["Naturaleza", "Bosques y cascadas", "/images/destination-mountain.webp"],
    ["Playa", "Horizontes abiertos", "/images/destination-beach.webp"],
    ["Aventura", "Rutas que retan", "/images/destination-canyon.webp"],
    ["Rutas culturales", "Memoria y sabor", "/images/destination-town.webp"],
    [
      "Viajes en grupo",
      "Camino compartido",
      "/images/destination-sailing.webp",
    ],
    ["Temporadas", "Momentos únicos", "/images/destination-patagonia.webp"],
  ];
  return (
    <main className="explorer-home">
      <section
        className="explorer-hero"
        tabIndex={0}
        aria-label={`Viaje destacado ${slide + 1} de ${slides.length}: ${active.title}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") next();
          if (event.key === "ArrowLeft") previous();
        }}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
          pauseTemporarily();
        }}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]?.clientX;
          if (
            touchStart.current !== null &&
            end !== undefined &&
            Math.abs(end - touchStart.current) > 45
          ) {
            if (end < touchStart.current) next();
            else previous();
          }
          touchStart.current = null;
        }}
      >
        <Image
          key={active.id}
          src={active.featuredImage}
          alt={`Paisaje de ${active.cities[0]}`}
          fill
          priority
          sizes="100vw"
        />
        <div className="explorer-hero-grain" />
        <div className="explorer-hero-identity">
          <strong>{String(slide + 1).padStart(2, "0")}</strong>
          <span>
            {productLabel(active.productType)}
            <small>
              {active.region === "mexico" ? "México" : active.countries[0]}
            </small>
          </span>
        </div>
        <div className="explorer-hero-copy">
          <span className="explorer-kicker">
            {active.cities[0]} · {active.countries[0]}
          </span>
          <h1>{active.title}</h1>
          <p>{active.summary}</p>
        </div>
        <aside
          className="explorer-hero-summary"
          aria-label="Precio y salida del viaje"
        >
          <span className="explorer-hero-price">
            <small>{active.basePrice.displayFrom ? "Desde" : "Precio"}</small>
            <b>
              {explorerPrice(
                active.basePrice.amount,
                active.basePrice.currency,
              )}
            </b>
          </span>
          <span>
            <small>Duración</small>
            <b>{active.durationDays} días</b>
          </span>
          <span>
            <small>Próxima salida</small>
            <b>{dateLabel(departure.startDate, true)}</b>
          </span>
        </aside>
        <div className="explorer-hero-actions">
          <button onClick={() => onOpen(active)}>Ver más</button>
          <a
            href={`https://wa.me/${agency.contact.whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por WhatsApp
          </a>
        </div>
        <div
          className="explorer-slider-controls"
          aria-label="Controles del slider"
        >
          <button
            onClick={previous}
            aria-label={EXPLORER_SLIDER_LABELS.previous}
          >
            ←
          </button>
          <strong>
            {String(slide + 1).padStart(2, "0")} <i>/</i>{" "}
            {String(slides.length).padStart(2, "0")}
          </strong>
          <div>
            {slides.map((item, index) => (
              <button
                key={item.id}
                className={index === slide ? "active" : ""}
                onClick={() => {
                  pauseTemporarily();
                  setSlide(index);
                }}
                aria-label={`Mostrar viaje ${index + 1}: ${item.title}`}
                aria-current={index === slide ? "true" : undefined}
              >
                <span />
              </button>
            ))}
          </div>
          <button onClick={next} aria-label={EXPLORER_SLIDER_LABELS.next}>
            →
          </button>
        </div>
        <ExplorerSearch onNavigate={onNavigate} />
      </section>
      <section className="explorer-categories">
        <header>
          <span>TIPOS DE VIAJE</span>
          <h2>Elige cómo quieres viajar</h2>
        </header>
        <div>
          {categories.map(([name, copy, image]) => (
            <button
              key={name}
              onClick={() =>
                onNavigate(`/viajes?q=${encodeURIComponent(name)}`)
              }
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 720px) 50vw, 25vw"
              />
              <span>
                <small>{copy}</small>
                <b>{name}</b>
                <i>↗</i>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="explorer-destinations">
        <header>
          <span>DESTINOS</span>
          <h2>Coordenadas favoritas</h2>
          <p>
            Rutas elegidas por su paisaje, su carácter y la historia que
            cuentan.
          </p>
          <button onClick={() => onNavigate("/destinos")}>
            Explorar destinos →
          </button>
        </header>
        <div className="explorer-mosaic">
          {places.map((place, index) => (
            <button
              key={place.id}
              className={`mosaic-${index + 1}`}
              onClick={() =>
                onNavigate(`/viajes?q=${encodeURIComponent(place.name)}`)
              }
            >
              <Image src={place.featuredImage} alt="" fill sizes="50vw" />
              <span>
                <small>
                  0{index + 1} ·{" "}
                  {trips.filter((trip) => trip.cities.includes(place.name))
                    .length || 1}{" "}
                  viajes
                </small>
                <b>{place.name}</b>
                <em>{place.country} ↗</em>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="explorer-featured">
        <header>
          <span>VIAJES POPULARES</span>
          <h2>Próximas expediciones</h2>
          <button onClick={() => onNavigate("/viajes")}>
            Ver calendario completo →
          </button>
        </header>
        <div className="explorer-card-grid">
          {trips.slice(0, 8).map((trip) => (
            <ExplorerCard key={trip.id} trip={trip} onOpen={onOpen} />
          ))}
        </div>
      </section>
      <section className="explorer-benefits">
        <Image
          src="/images/destination-canyon.webp"
          alt=""
          fill
          sizes="100vw"
        />
        <header>
          <span>VIAJAR CON FURIVER</span>
          <h2>
            La tranquilidad
            <br />
            también es parte
            <br />
            del camino.
          </h2>
        </header>
        <div>
          <span>01</span>
          <i>⌖</i>
          <h3>Salidas claras</h3>
          <p>
            Fecha, hora y punto de abordaje visibles desde antes de reservar.
          </p>
        </div>
        <div>
          <span>02</span>
          <i>◎</i>
          <h3>Grupo acompañado</h3>
          <p>Coordinación humana antes, durante y después de cada ruta.</p>
        </div>
        <div>
          <span>03</span>
          <i>◇</i>
          <h3>Precio honesto</h3>
          <p>Anticipo, impuestos y saldo explicados sin letras pequeñas.</p>
        </div>
      </section>
      <section className="explorer-route-search">
        <div>
          <span>ENCUENTRA TU PRÓXIMA RUTA</span>
          <h2>
            Una fecha libre puede
            <br />
            convertirse en historia.
          </h2>
          <p>
            Busca por destino, experiencia y fecha. Si todavía no lo tienes
            claro, te ayudamos por WhatsApp.
          </p>
          <div>
            <button onClick={() => onNavigate("/viajes")}>
              Abrir catálogo
            </button>
            <a
              href={`https://wa.me/${agency.contact.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              Pedir recomendación ↗
            </a>
          </div>
        </div>
        <ExplorerSearch onNavigate={onNavigate} />
      </section>
      <section
        className="explorer-promo"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(7,12,15,.94),rgba(7,12,15,.2)),url(${trips[2].featuredImage})`,
        }}
      >
        <span>CAMPAÑA · RUTAS DE TEMPORADA</span>
        <h2>
          Anticipo ligero.
          <br />
          El camino, completo.
        </h2>
        <strong>
          {trips[2].depositPolicy?.type === "percentage"
            ? `Reserva con ${trips[2].depositPolicy.percentage}% de anticipo`
            : `Aparta desde ${explorerPrice(depositAmount(trips[2].depositPolicy, trips[2].basePrice.amount, trips[2].basePrice.depositAmount ?? trips[2].basePrice.amount), trips[2].basePrice.currency)}`}
        </strong>
        <p>
          Válido en salidas seleccionadas hasta el 30 de septiembre de 2026.
          Sujeto a condiciones visibles antes de reservar.
        </p>
        <button onClick={() => onNavigate("/promociones")}>
          Ver rutas participantes ↗
        </button>
      </section>
      <section className="explorer-story">
        <div className="explorer-story-image">
          <Image
            src="/images/destination-town.webp"
            alt="Calle tradicional en una ruta Furiver"
            fill
            sizes="50vw"
          />
        </div>
        <div>
          <span>DESDE LA PRIMERA SALIDA</span>
          <h2>Furiver nació para hacer sencillo lo que se siente enorme.</h2>
          <p>
            Reunimos rutas cercanas, anfitriones locales y una operación clara
            para que cada viajero pueda concentrarse en estar presente.
          </p>
          <div>
            <b>10+</b>
            <small>rutas activas</small>
            <b>3</b>
            <small>puntos de salida</small>
            <b>100%</b>
            <small>acompañadas</small>
          </div>
          <button onClick={() => onNavigate("/nosotros")}>
            Conocer nuestra forma de viajar →
          </button>
        </div>
      </section>
      <blockquote className="explorer-quote">
        “No coleccionamos destinos.
        <br />
        <em>Coleccionamos el momento exacto</em>
        <br />
        en que algo cambia.”<cite>— Diario de ruta Furiver</cite>
      </blockquote>
      <section className="explorer-journal">
        <header>
          <span>CUADERNO DE CAMINO</span>
          <h2>
            Guías, consejos
            <br />y diario de ruta.
          </h2>
        </header>
        <div>
          {[
            [
              "Guía",
              "Cómo elegir tu punto de salida",
              "Llegar con tiempo también forma parte de un buen viaje.",
            ],
            [
              "Consejos",
              "Equipaje ligero para un fin de semana",
              "Lo esencial para moverte cómodo y disfrutar más.",
            ],
            [
              "Diario",
              "La hora azul en un pueblo de montaña",
              "Una crónica breve desde el camino compartido.",
            ],
          ].map(([kind, title, copy], index) => (
            <article key={title}>
              <span>
                0{index + 1} · {kind}
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <button>Leer entrada →</button>
            </article>
          ))}
        </div>
      </section>
      <section
        className="explorer-final"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(8,14,18,.92),rgba(8,14,18,.25)),url(${trips[3].featuredImage})`,
        }}
      >
        <span>LA CARRETERA ESTÁ LISTA</span>
        <h2>
          Tu siguiente historia
          <br />
          sale este fin de semana.
        </h2>
        <button onClick={() => onNavigate("/viajes")}>
          Ver próximas salidas ↗
        </button>
      </section>
    </main>
  );
}

function ExplorerFooter({ agency, onNavigate }: FooterProps) {
  return (
    <footer className="explorer-footer">
      <Logo agency={agency} light />
      <h2>La ruta sigue.</h2>
      <div>
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => onNavigate(`/${item.toLowerCase()}`)}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="explorer-footer-social">
        <span>Síguenos</span>
        <ExplorerSocialLinks agency={agency} placement="footer" />
      </section>
      <p>
        {agency.contact.email} · WhatsApp {agency.contact.whatsapp}
      </p>
      <small>© 2026 · EXPERIENCIAS DEMO · SIN PAGOS REALES</small>
    </footer>
  );
}
const themeRenderers: Record<TravelTheme, ThemeComponents> = {
  explorer: {
    Header: ExplorerHeader,
    Home: ExplorerHome,
    Footer: ExplorerFooter,
  },
  lavella: {
    Header: LavellaHeader,
    Home: LavellaHome,
    Footer: LavellaFooter,
  },
};

function DemoControls({
  agency,
  theme,
  onChange,
}: {
  agency: Agency;
  theme: TravelTheme;
  onChange: (key: string, value: string) => void;
}) {
  const [mode, setMode] = useState<"open" | "collapsed" | "hidden">("open");
  useEffect(() => {
    const saved = localStorage.getItem("fu-travel-demo-controls");
    if (saved === "hidden") setMode("hidden");
    else if (window.matchMedia("(max-width: 720px)").matches)
      setMode("collapsed");
  }, []);
  const hide = () => {
    setMode("hidden");
    localStorage.setItem("fu-travel-demo-controls", "hidden");
  };
  if (mode === "hidden") return null;
  if (mode === "collapsed")
    return (
      <button
        className="demo-controls-collapsed"
        onClick={() => setMode("open")}
        aria-label="Abrir controles de demostración"
      >
        FU / Demo
      </button>
    );
  return (
    <aside className="demo-controls" data-testid="demo-controls">
      <header>
        <span>
          <b>FU TRAVEL OS</b>
          {theme === "explorer" ? "Estudio demo" : "Demo studio"}
        </span>
        <div>
          <button
            onClick={() => setMode("collapsed")}
            aria-label="Colapsar controles"
          >
            −
          </button>
          <button onClick={hide}>Ocultar ×</button>
        </div>
      </header>
      <label>
        Agencia
        <select
          value={agency.slug}
          onChange={(event) => onChange("tenant", event.target.value)}
        >
          {agencies.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tema
        <select
          value={theme}
          onChange={(event) => onChange("theme", event.target.value)}
        >
          <option value="explorer">Explorer</option>
          <option value="lavella">Lavella</option>
        </select>
      </label>
      <label>
        Vista
        <select
          defaultValue="public"
          onChange={(event) => onChange("view", event.target.value)}
        >
          <option value="public">Sitio público</option>
          <option value="admin">Administración</option>
        </select>
      </label>
    </aside>
  );
}

function ExplorerCatalog({
  agency,
  onOpen,
}: {
  agency: Agency;
  onOpen: OpenTrip;
}) {
  const query = currentParams().get("q") ?? "";
  const [filters, setFilters] = useState<CatalogFilters>({
    q: query,
    sort: "next",
  });
  const [mobileFilters, setMobileFilters] = useState(false);
  const own = travels.filter((trip) => trip.agencyId === agency.id);
  const results = filterCatalog(own, filters);
  const update = (key: keyof CatalogFilters, value: string | boolean) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const counts = {
    national: own.filter((trip) => trip.scope === "national").length,
    international: own.filter((trip) => trip.scope === "international").length,
    usd: own.filter((trip) => trip.basePrice.currency === "USD").length,
  };
  return (
    <main className="v2-catalog explorer-catalog">
      <header className="v2-catalog-hero">
        <Image
          src={heroImages.explorer}
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div>
          <span>COLECCIÓN DE VIAJES</span>
          <h1>Elige tu próxima coordenada.</h1>
          <p>Filtra sin perder la inspiración.</p>
        </div>
      </header>
      <div className="v2-catalog-layout">
        <aside className={`v2-filters ${mobileFilters ? "is-open" : ""}`}>
          <header>
            <h2>Filtrar resultados</h2>
            <button onClick={() => setMobileFilters(false)}>Cerrar</button>
          </header>
          <label>
            Palabra clave
            <input
              value={String(filters.q ?? "")}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Destino, ciudad, código"
            />
          </label>
          <fieldset>
            <legend>Alcance</legend>
            <label>
              <input
                type="radio"
                name="scope"
                checked={!filters.scope}
                onChange={() => update("scope", "")}
              />
              Todos <b>{own.length}</b>
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                checked={filters.scope === "national"}
                onChange={() => update("scope", "national")}
              />
              Nacional <b>{counts.national}</b>
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                checked={filters.scope === "international"}
                onChange={() => update("scope", "international")}
              />
              Internacional <b>{counts.international}</b>
            </label>
          </fieldset>
          <label>
            Región
            <select
              value={String(filters.region ?? "")}
              onChange={(event) => update("region", event.target.value)}
            >
              <option value="">Todas</option>
              <option value="mexico">México</option>
              <option value="europe">Europa</option>
              <option value="south_america">Sudamérica</option>
              <option value="asia">Asia</option>
              <option value="central_america_caribbean">Caribe</option>
            </select>
          </label>
          <label>
            Transporte
            <select
              value={String(filters.transport ?? "")}
              onChange={(event) => update("transport", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="ground">Terrestre</option>
              <option value="air">Aéreo</option>
              <option value="cruise">Crucero</option>
              <option value="mixed">Mixto</option>
            </select>
          </label>
          <label>
            Moneda
            <select
              value={String(filters.currency ?? "")}
              onChange={(event) => update("currency", event.target.value)}
            >
              <option value="">MXN y USD</option>
              <option value="MXN">MXN ({own.length - counts.usd})</option>
              <option value="USD">USD ({counts.usd})</option>
            </select>
          </label>
          <button
            className="clear-filters"
            onClick={() => setFilters({ sort: "next" })}
          >
            Limpiar todos los filtros
          </button>
        </aside>
        <section className="v2-results">
          <div className="v2-results-toolbar">
            <button
              className="mobile-filter-button"
              onClick={() => setMobileFilters(true)}
            >
              Filtros <b>{results.length}</b>
            </button>
            <span>
              <b>{results.length}</b> programas encontrados
            </span>
            <label>
              Ordenar por
              <select
                value={String(filters.sort)}
                onChange={(event) => update("sort", event.target.value)}
              >
                <option value="next">Más relevantes</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="duration">Duración</option>
              </select>
            </label>
          </div>
          {results.length === 0 ? (
            <div className="v2-empty">
              <h2>No encontramos una ruta así.</h2>
              <p>Prueba con menos filtros o restablece la búsqueda.</p>
              <button onClick={() => setFilters({ sort: "next" })}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="v2-card-grid explorer-results-grid">
              {results.map((trip) => (
                <ExplorerCard key={trip.id} trip={trip} onOpen={onOpen} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ExplorerBookingPanel({
  agency,
  trip,
  selectedDepartureId,
  onDepartureChange,
}: {
  agency: Agency;
  trip: TravelProduct;
  selectedDepartureId?: string;
  onDepartureChange?: (id: string) => void;
}) {
  const initialDeparture = available(trip);
  const [internalDepartureId, setInternalDepartureId] = useState(initialDeparture.id);
  const departureId = selectedDepartureId ?? internalDepartureId;
  const departure = trip.departures.find((item) => item.id === departureId)!;
  const [boardingId, setBoardingId] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requiresOccupancy = trip.accommodationMode === "hotel_occupancy";
  const occupancy = explorerAdultRateOccupancy(trip, adults);
  const adultRate = trip.pricingOptions.find(
    (item) => item.occupancy === occupancy,
  );
  const childRate = trip.pricingOptions.find(
    (item) => item.occupancy === "child",
  );
  const startingPrice = getTripDisplayStartingPrice({ trip, departure });
  const roomPolicy = resolveRoomCapacityPolicy(agency, trip, adultRate);
  const roomCapacity = validateRoomCapacity({
    adults,
    minors: children,
    maxGuestsPerRoom: roomPolicy.defaultMaxGuestsPerRoom,
    adultCountsTowardCapacity: roomPolicy.adultCountsTowardCapacity,
    minorCountsTowardCapacity: roomPolicy.minorCountsTowardCapacity,
    infantCountsTowardCapacity: roomPolicy.infantCountsTowardCapacity,
  });
  const roomCapacityApplies = requiresOccupancy && roomPolicy.enabled;
  const roomCapacityValid = !roomCapacityApplies || roomCapacity.valid;
  const adultLine: CartLine | undefined = adultRate
    ? {
        id: `line-${trip.id}-adultos`,
        agencyId: agency.id,
        travelId: trip.id,
        departureId,
        boardingOptionId: boardingId,
        pricingOptionId: adultRate.id,
        travelers: adults,
        extraIds: [],
        travelerDataStatus: "pending",
        travelerDrafts: createTravelerDrafts(
          adults,
          0,
          `${trip.id}-${departureId}`,
        ),
      }
    : undefined;
  const childLine: CartLine | undefined =
    children && childRate
      ? {
          id: `line-${trip.id}-menores`,
          agencyId: agency.id,
          travelId: trip.id,
          departureId,
          boardingOptionId: boardingId,
          pricingOptionId: childRate.id,
          travelers: children,
          extraIds: [],
          travelerDataStatus: "pending",
          travelerDrafts: createTravelerDrafts(
            0,
            children,
            `${trip.id}-${departureId}`,
          ),
        }
      : undefined;
  let pricedAdult: ReturnType<typeof priceLinePending> | undefined;
  let pricedChild: ReturnType<typeof priceLinePending> | undefined;
  try {
    if (adultLine) pricedAdult = priceLinePending(adultLine);
    if (childLine) pricedChild = priceLinePending(childLine);
  } catch {
    pricedAdult = undefined;
    pricedChild = undefined;
  }
  const total = (pricedAdult?.total ?? 0) + (pricedChild?.total ?? 0);
  const subtotal = (pricedAdult?.subtotal ?? 0) + (pricedChild?.subtotal ?? 0);
  const taxes = (pricedAdult?.taxes ?? 0) + (pricedChild?.taxes ?? 0);
  const additionalCharges = (pricedAdult?.extrasTotal ?? 0) + (pricedChild?.extrasTotal ?? 0);
  const policy = departure.depositPolicy ?? trip.depositPolicy;
  const deposit = depositAmount(
    policy,
    total,
    (trip.basePrice.depositAmount ?? trip.basePrice.amount) *
      (adults + children),
    adults + children,
  );
  const canReserve = Boolean(
    pricedAdult &&
    (!requiresOccupancy || (occupancy && adults <= 4)) &&
    (!children || pricedChild) &&
    roomCapacityValid,
  );
  const mobilePrice = explorerPrice(
    startingPrice.amount,
    startingPrice.currency,
  ).replace(/\s+(MXN|USD)$/u, "");
  const changeDeparture = (id: string) => {
    setInternalDepartureId(id);
    onDepartureChange?.(id);
    setBoardingId(null);
  };
  const add = () => {
    if (!canReserve || !adultLine) return;
    const existing = JSON.parse(
      localStorage.getItem("fu-travel-demo-cart") ?? "[]",
    ) as CartLine[];
    if (existing.length && existing[0].agencyId !== agency.id) {
      window.alert("El carrito pertenece a otra agencia.");
      return;
    }
    const priorLines = existing.filter(
      (item) => item.travelId === trip.id && item.departureId === departureId,
    );
    const priorDrafts = draftsFromLines(priorLines);
    let reconciled = reconcileTravelerDrafts({
      drafts: priorDrafts,
      adults,
      minors: children,
      scope: `${trip.id}-${departureId}`,
    });
    if (
      reconciled.requiresConfirmation &&
      !window.confirm(
        "Reducir viajeros descartará datos ya capturados. ¿Deseas continuar?",
      )
    )
      return;
    if (reconciled.requiresConfirmation) {
      reconciled = reconcileTravelerDrafts({
        drafts: priorDrafts,
        adults,
        minors: children,
        scope: `${trip.id}-${departureId}`,
        confirmDiscard: true,
      });
    }
    const lines = [adultLine, childLine].filter(Boolean).map((line) => ({
      ...line!,
      travelerDataStatus:
        priorLines[0]?.travelerDataStatus ?? ("complete" as const),
      travelerDrafts: reconciled.drafts.filter(
        (draft) =>
          draft.category ===
          (line!.id.endsWith("-menores") ? "minor" : "adult"),
      ),
    })) as CartLine[];
    localStorage.setItem(
      "fu-travel-demo-cart",
      JSON.stringify([
        ...existing.filter((item) => !item.id.startsWith(`line-${trip.id}-`)),
        ...lines,
      ]),
    );
    localStorage.setItem(
      "fu-travel-booking-draft",
      JSON.stringify({
        travelId: trip.id,
        departureId,
        adults,
        children,
        ...(requiresOccupancy ? { occupancy } : {}),
        total,
        deposit,
      }),
    );
    window.location.assign(`/carrito${window.location.search}`);
  };
  const bookingMessage = explorerBookingMessage({
    agencyName: agency.name,
    trip,
    departureLabel: dateLabel(departure.startDate, true),
    adults,
    children,
    occupancyLabel: occupancy ? occupancyName(occupancy) : undefined,
    totalLabel: explorerPrice(total, trip.basePrice.currency),
    depositLabel: explorerPrice(deposit, trip.basePrice.currency),
    url: mounted ? window.location.href : "",
    roomCapacity: roomCapacityApplies
      ? {
          exceeded: !roomCapacity.valid,
          maxGuestsPerRoom: roomPolicy.defaultMaxGuestsPerRoom,
          totalGuests: roomCapacity.totalCountedGuests,
        }
      : undefined,
  });
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const hero = document.querySelector(".explorer-detail-cover");
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
    sheetRef.current
      ?.querySelector<HTMLButtonElement>(".explorer-sheet-close")
      ?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(false);
      if (event.key !== "Tab" || !sheetRef.current) return;
      const items = [
        ...sheetRef.current.querySelectorAll<HTMLElement>(
          "button,a[href],input,select",
        ),
      ].filter((item) => !item.hasAttribute("disabled"));
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
      if (
        !event.shiftKey &&
        document.activeElement === items[items.length - 1]
      ) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
      triggerRef.current?.focus();
    };
  }, [sheet]);
  const fields = (
    <>
      <header className="explorer-booking-head">
        <span>
          <small>
            {trip.basePrice.displayFrom ? "Precio desde" : "Precio"}
          </small>
          <strong>
            {explorerPrice(startingPrice.amount, startingPrice.currency)}
          </strong>
        </span>
        <span>
          <small>Anticipo</small>
          <b>{explorerPrice(deposit, trip.basePrice.currency)}</b>
        </span>
      </header>
      <label>
        Fecha
        <select
          value={departureId}
          onChange={(event) => changeDeparture(event.target.value)}
        >
          {trip.departures.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={item.saleStatus === "sold_out"}
            >
              {dateLabel(item.startDate, true)} ·{" "}
              {item.saleStatus === "sold_out" ? "Agotada" : "Programada"}
            </option>
          ))}
        </select>
      </label>
      <div className="explorer-traveler-controls">
        <div>
          <span>
            <b>Adultos</b>
            <small>
              {trip.travelerCategories?.find(
                (item) => item.pricingRule === "adult",
              )?.minAge ?? 12}{" "}
              años en adelante
            </small>
          </span>
          <span>
            <button
              onClick={() => setAdults((value) => Math.max(1, value - 1))}
              aria-label="Quitar un adulto"
            >
              −
            </button>
            <b>{adults}</b>
            <button
              onClick={() =>
                setAdults((value) =>
                  Math.min(requiresOccupancy ? 5 : 8, value + 1),
                )
              }
              aria-label="Agregar un adulto"
            >
              +
            </button>
          </span>
        </div>
        <div>
          <span>
            <b>Menores</b>
            <small>
              {trip.travelerCategories?.find(
                (item) => item.pricingRule === "child",
              )?.minAge ?? 3}{" "}
              a{" "}
              {trip.travelerCategories?.find(
                (item) => item.pricingRule === "child",
              )?.maxAge ?? 11}{" "}
              años
            </small>
          </span>
          <span>
            <button
              onClick={() => setChildren((value) => Math.max(0, value - 1))}
              aria-label="Quitar un menor"
            >
              −
            </button>
            <b>{children}</b>
            <button
              onClick={() => setChildren((value) => Math.min(4, value + 1))}
              aria-label="Agregar un menor"
            >
              +
            </button>
          </span>
        </div>
      </div>
      {roomCapacityApplies &&
        (roomCapacity.valid ? (
          <p className="explorer-room-capacity is-valid">
            <span aria-hidden="true">✓</span>
            <span>
              {roomCapacity.totalCountedGuests} de{" "}
              {roomPolicy.defaultMaxGuestsPerRoom} personas por habitación
            </span>
          </p>
        ) : (
          <div className="explorer-room-capacity is-invalid" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>
              Máximo {roomPolicy.defaultMaxGuestsPerRoom} personas por
              habitación. Seleccionaste {roomCapacity.totalCountedGuests}.
              Ajusta viajeros o consulta dos habitaciones.
            </span>
          </div>
        ))}
      {requiresOccupancy && (
        <div className="explorer-occupancy">
          <span>Base de ocupación</span>
          <strong>{occupancyName(occupancy)}</strong>
          <small>
            {occupancy
              ? `${adults} ${adults === 1 ? "adulto" : "adultos"}`
              : "Requiere más de una habitación"}
          </small>
        </div>
      )}
      <div className="explorer-booking-footer">
        <div className="explorer-booking-total">
          <span className="explorer-total-line">
            <span>Subtotal</span>
            <b>{explorerPrice(subtotal, trip.basePrice.currency)}</b>
          </span>
          {taxes > 0 ? (
            <span className="explorer-total-line">
              <span>{trip.basePrice.taxesLabel ?? "Impuestos"}</span>
              <b>{explorerPrice(taxes, trip.basePrice.currency)}</b>
            </span>
          ) : !trip.basePrice.taxesIncluded ? (
            <span className="explorer-total-line is-pending">
              <span>Impuestos</span>
              <b>Por confirmar</b>
            </span>
          ) : null}
          {additionalCharges > 0 && (
            <span className="explorer-total-line">
              <span>Cargos adicionales</span>
              <b>{explorerPrice(additionalCharges, trip.basePrice.currency)}</b>
            </span>
          )}
          <strong>
            <span>Total</span>
            <b>
              {canReserve
                ? explorerPrice(total, trip.basePrice.currency)
                : "Por confirmar"}
            </b>
          </strong>
          <small>
            {trip.basePrice.taxesIncluded
              ? "Impuestos incluidos"
              : taxes > 0
                ? "Impuestos desglosados en el total"
                : "Impuestos por confirmar"}
          </small>
        </div>
        <button
          className="explorer-booking-add"
          disabled={!canReserve}
          onClick={add}
        >
          {roomCapacityValid
            ? "Reservar este viaje"
            : "Ajusta la cantidad de viajeros"}
        </button>
        {mounted && (
          <a
            className="explorer-booking-wa"
            href={whatsappLink(
              agency.settings.whatsapp?.phone ?? agency.contact.whatsapp,
              bookingMessage,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por WhatsApp ↗
          </a>
        )}
      </div>
    </>
  );
  return (
    <>
      <aside className="explorer-booking-panel" id="reserva">
        {fields}
      </aside>
      <div
        className={`explorer-mobile-booking ${showMobileBar ? "is-visible" : ""}`}
      >
        <span className="explorer-mobile-booking-price">
          <small>{trip.basePrice.displayFrom ? "Desde" : "Precio"}</small>
          <b>
            {mobilePrice} <em>{trip.basePrice.currency}</em>
          </b>
        </span>
        <button
          ref={triggerRef}
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
        >
          Reservar
        </button>
        {mounted && (
          <a
            href={whatsappLink(
              agency.settings.whatsapp?.phone ?? agency.contact.whatsapp,
              bookingMessage,
            )}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contactar por WhatsApp"
            title="Contactar por WhatsApp"
          >
            <FaWhatsapp aria-hidden="true" focusable="false" />
          </a>
        )}
      </div>
      {sheet && (
        <div
          className="explorer-sheet-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSheet(false)
          }
        >
          <div
            className="explorer-booking-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Configurar reserva"
          >
            <div className="explorer-sheet-title">
              <span>Configura tu reserva</span>
              <button
                className="explorer-sheet-close"
                onClick={() => setSheet(false)}
                aria-label="Cerrar reserva"
              >
                ×
              </button>
            </div>
            <div className="explorer-sheet-scroll">{fields}</div>
          </div>
        </div>
      )}
    </>
  );
}

function ExplorerGallery({ trip }: { trip: TravelProduct }) {
  const images = trip.galleryImages?.length
    ? [...trip.galleryImages].sort((a, b) => a.order - b.order).map((item) => item.url)
    : [trip.featuredImage, ...trip.gallery];
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) =>
      event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selected]);
  return (
    <section className="explorer-gallery" aria-labelledby="gallery-title">
      <header>
        <span className="section-label">GALERÍA</span>
        <h2 id="gallery-title">Una ruta, muchas escenas.</h2>
      </header>
      <div>
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            onClick={() => setSelected(image)}
            aria-label={`Ampliar fotografía ${index + 1}`}
          >
            <Image
              src={image}
              alt=""
              fill
              sizes={index === 0 ? "60vw" : "30vw"}
            />
          </button>
        ))}
      </div>
      {selected && (
        <div
          className="explorer-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Fotografía ampliada"
        >
          <button onClick={() => setSelected(null)} aria-label="Cerrar galería">
            ×
          </button>
          <Image
            src={selected}
            alt={`Vista ampliada de ${trip.title}`}
            fill
            sizes="95vw"
          />
        </div>
      )}
    </section>
  );
}

function ItineraryDownload({ agency, trip }: { agency: Agency; trip: TravelProduct }) {
  const settings = trip.itineraryDownload;
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!settings?.enabled || !isSafeDownloadUrl(settings.fileUrl)) return null;
  const download = async () => {
    if (settings.requireLeadForm) {
      const next = validateLead({ name, whatsapp, consent });
      setErrors(next);
      if (Object.keys(next).length) return;
      await localItineraryLeadCaptureService.capture({
        agencyId: agency.id, tripId: trip.id, name: name.trim(),
        whatsapp: whatsapp.replace(/[^\d+]/g, ""), documentUrl: settings.fileUrl!,
        pageUrl: window.location.href, capturedAt: new Date().toISOString(),
      });
    }
    const anchor = document.createElement("a");
    anchor.href = settings.fileUrl!;
    anchor.download = settings.fileName ?? "";
    anchor.click();
  };
  return (
    <aside className="trip-download">
      <div><span className="section-label">ITINERARIO DESCARGABLE</span><h3>{settings.title ?? "Lleva la ruta contigo"}</h3><p>{settings.description}</p></div>
      {settings.requireLeadForm && (
        <div className="trip-download-form">
          <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} aria-describedby={errors.name ? "lead-name-error" : undefined} /></label>
          {errors.name && <small id="lead-name-error" role="alert">{errors.name}</small>}
          <label>WhatsApp<input inputMode="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} aria-describedby={errors.whatsapp ? "lead-phone-error" : undefined} /></label>
          {errors.whatsapp && <small id="lead-phone-error" role="alert">{errors.whatsapp}</small>}
          <label className="trip-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Acepto el uso de mis datos para recibir el itinerario. <Link href="/aviso-de-privacidad">Aviso de privacidad</Link>.</label>
          {errors.consent && <small role="alert">{errors.consent}</small>}
        </div>
      )}
      <button onClick={download}>Descargar itinerario {settings.fileSizeLabel ? `· ${settings.fileSizeLabel}` : ""}</button>
    </aside>
  );
}

function ConfigurableTripSection({
  section, agency, trip, departure, onDepartureChange,
}: {
  section: TripSectionConfig; agency: Agency; trip: TravelProduct; departure: NonNullable<TravelProduct["departures"][number]>;
  onDepartureChange: (id: string) => void;
}) {
  const title = section.title ?? section.anchorLabel;
  if (section.type === "summary") {
    const content = trip.summaryContent!;
    const destinations = content.visitedDestinationsOverride ?? getVisitedDestinations(trip.itinerary, content.maxVisitedDestinations);
    const price = getTripDisplayStartingPrice({ trip, departure });
    return <section id={section.id} className="trip-section trip-summary"><header><span className="section-label">{trip.code} · RESUMEN</span><h2>{title ?? "Todo lo esencial"}</h2></header><p>{content.shortDescription}</p><div className="trip-summary-facts">{content.showDuration && <span><b>{formatTripDuration(trip.durationDays, trip.durationNights)}</b><small>Duración</small></span>}{content.showStartingPrice && <span><b>{explorerPrice(price.amount, price.currency)}</b><small>{price.label}</small></span>}</div>{content.showVisitedDestinations && destinations.length > 0 && <p className="trip-visited"><b>Visitando:</b> {destinations.join(" · ")}</p>}{content.showUpcomingDepartures && <div className="explorer-next-dates"><b>Próximas salidas:</b>{trip.departures.filter((item) => item.saleStatus !== "sold_out").slice(0, content.maxUpcomingDepartures ?? 3).map((item) => <button className={item.id === departure.id ? "active" : ""} key={item.id} onClick={() => onDepartureChange(item.id)}>{dateLabel(item.startDate)}</button>)}</div>}</section>;
  }
  if (section.type === "video") {
    const presentation = getSafeVideoPresentation(trip.videoContent);
    if (!presentation) return null;
    return <section id={section.id} className="trip-section trip-video"><header><span className="section-label">VIDEO</span><h2>{trip.videoContent?.title ?? title}</h2></header><div className={`trip-video-frame ratio-${trip.videoContent?.aspectRatio?.replace(":", "-") ?? "16-9"}`}>{presentation.mode === "iframe" ? <iframe src={presentation.url} title={trip.videoContent?.title ?? "Video del viaje"} loading="lazy" allow="fullscreen; picture-in-picture" /> : presentation.mode === "html5" ? <video controls playsInline poster={trip.videoContent?.posterUrl}><source src={presentation.url} /></video> : <a href={presentation.url} target="_blank" rel="noreferrer">Ver video en {trip.videoContent?.provider}</a>}</div><p>{trip.videoContent?.caption}</p></section>;
  }
  if (section.type === "gallery") return <div id={section.id} className="trip-section"><ExplorerGallery trip={trip} /></div>;
  if (section.type === "itinerary") return <ConfigurableItinerary section={section} agency={agency} trip={trip} />;
  if (section.type === "included") {
    const content = trip.inclusionsContent;
    return <section id={section.id} className="trip-section explorer-includes-refined">{content?.included.length ? <div><h2>Incluye</h2>{content.included.sort((a,b)=>a.order-b.order).map((item)=><p key={item.id}><i>✓</i>{item.text}</p>)}</div>:null}{content?.excluded.length ? <div><h2>No incluye</h2>{content.excluded.sort((a,b)=>a.order-b.order).map((item)=><p key={item.id}><i>×</i>{item.text}</p>)}</div>:null}</section>;
  }
  if (section.type === "map") {
    const stops = getOrderedRouteStops(trip.mapSettings);
    return <section id={section.id} className="trip-section trip-map"><header><span className="section-label">RUTA</span><h2>{title ?? "El viaje sobre el mapa"}</h2></header><div className="trip-map-canvas" aria-label="Representación de la ruta">{stops.length ? stops.map((stop, index)=><span key={stop.id}><b>{index + 1}</b><small>Día {stop.dayNumber}</small>{stop.name}</span>) : <span><b>1</b>{trip.mapSettings?.mainDestination?.name}</span>}</div><p>Representación informativa. La ruta definitiva se confirma con la operación.</p></section>;
  }
  if (section.type === "departures") {
    return <section id={section.id} className="trip-section explorer-departures-refined"><span className="section-label">FECHAS DISPONIBLES</span><h2>{title ?? "Elige cuándo partir"}</h2>{trip.departures.map((item)=>{const price=getTripDisplayStartingPrice({trip,departure:item});return <div className={item.id===departure.id?"active":""} key={item.id}><time>{dateLabel(item.startDate,true)}</time><span>Desde {explorerPrice(price.amount,price.currency)} <small>{price.label}</small></span><b>{item.saleStatus==="sold_out"?"Agotada":item.saleStatus==="limited"?"Últimos lugares":"Programada"}</b><button disabled={item.saleStatus==="sold_out"} onClick={()=>onDepartureChange(item.id)}>Elegir fecha</button></div>})}</section>;
  }
  if (section.type === "rates") {
    return <section id={section.id} className="trip-section explorer-rates"><span className="section-label">TARIFAS</span><h2>{title ?? "Tarifas por ocupación"}</h2><div className={`explorer-rate-grid ${trip.accommodationMode === "none" ? "is-traveler-rates" : ""}`}>{trip.pricingOptions.filter((rate)=>explorerVisibleRateOccupancies(trip).includes(rate.occupancy)).map((rate)=><div className={rate.occupancy==="double"?"is-reference":""} key={rate.id}><span><b>{rate.occupancy==="general"?"Adulto":occupancyName(rate.occupancy)}</b><small>{rate.occupancy==="double"&&trip.accommodationMode==="hotel_occupancy"?"Base usada para “precio desde”":trip.accommodationMode==="none"?`Tarifa por ${rate.occupancy==="general"?"adulto":occupancyName(rate.occupancy).toLowerCase()}`:`Precio por adulto en base ${occupancyName(rate.occupancy).toLowerCase()}`}</small></span><strong>{explorerPrice(getEffectiveRateAmount({trip,departure,rate}),rate.currency)}</strong></div>)}</div></section>;
  }
  if (section.type === "recommendations") {
    const items=getRecommendationItems(trip); return <section id={section.id} className="trip-section trip-recommendations"><header><span className="section-label">RECOMENDACIONES</span><h2>{title ?? "Prepárate para la ruta"}</h2></header>{trip.recommendationsContent?.difficulty&&<aside><b>{trip.recommendationsContent.difficulty.label}</b><p>{trip.recommendationsContent.difficulty.description}</p></aside>}<ul>{items.map((item)=><li key={item.id}>{item.title&&<b>{item.title}</b>}{item.text}</li>)}</ul></section>;
  }
  if (section.type === "departure_points") {
    const points=getPublicDeparturePoints(trip.publicDeparturePoints); return <section id={section.id} className="trip-section trip-points"><header><span className="section-label">PUNTOS DE SALIDA</span><h2>{title ?? "Dónde comienza el viaje"}</h2></header><div>{points.map((point)=><article key={point.id}><span>{point.type==="airport"?"AEROPUERTO":"SALIDA TERRESTRE"}</span><h3>{point.name}{point.airportCode?` · ${point.airportCode}`:""}</h3><p>{[point.address,point.reference,point.city].filter(Boolean).join(" · ")}</p><small>{[point.meetingTime&&`Encuentro ${point.meetingTime}`,point.departureTime&&`Salida ${point.departureTime}`].filter(Boolean).join(" · ")}</small><p>{point.instructions}</p></article>)}</div></section>;
  }
  if (section.type === "important_information") return <section id={section.id} className="trip-section trip-important"><header><span className="section-label">INFORMACIÓN IMPORTANTE</span><h2>{title ?? "Antes de reservar"}</h2><p>{trip.importantInformation?.introduction}</p></header><div>{trip.importantInformation?.items.sort((a,b)=>a.order-b.order).map((item)=><article className={item.severity??"info"} key={item.id}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>;
  if (section.type === "faq") return <section id={section.id} className="trip-section explorer-policies"><span className="section-label">PREGUNTAS FRECUENTES</span><h2>{title ?? "Resolvemos tus dudas"}</h2><p>{trip.faqContent?.introduction}</p>{trip.faqContent?.items.sort((a,b)=>a.order-b.order).map((item)=><details key={item.id}><summary>{item.question}<i>+</i></summary><p>{item.answer}</p></details>)}</section>;
  return null;
}

function ConfigurableItinerary({ section, agency, trip }: { section: TripSectionConfig; agency: Agency; trip: TravelProduct }) {
  const settings = trip.itinerarySettings!;
  const [openDays, setOpenDays] = useState(() => getInitialItineraryOpenDays(settings.displayMode, trip.itinerary.length));
  const toggle = (index: number) => setOpenDays((current) => current.includes(index) ? current.filter((item)=>item!==index) : [...current,index]);
  return <section id={section.id} className="trip-section explorer-program"><header><span className="section-label">PROGRAMA POR ETAPAS</span><h2>{section.title ?? "El camino, día a día"}</h2><div className="itinerary-actions">{settings.allowExpandAll&&<button onClick={()=>setOpenDays(trip.itinerary.map((_,index)=>index))}>Desplegar todo</button>}{settings.allowCollapseAll&&<button onClick={()=>setOpenDays([])}>Contraer todo</button>}</div></header>{trip.itinerary.map((day,index)=><article className={openDays.includes(index)?"open":""} key={day.id??`day-${day.day}`}><button className="itinerary-trigger" aria-expanded={openDays.includes(index)} onClick={()=>toggle(index)}><b>{String(day.day).padStart(2,"0")}</b><span><small>DÍA {day.day}</small>{day.title}</span><i>+</i></button>{openDays.includes(index)&&<div className="itinerary-body"><p>{day.description}</p>{settings.showTimes&&day.startTime&&<small>{day.startTime}{day.endTime?` – ${day.endTime}`:""}</small>}{settings.showStops&&Boolean(day.stops?.length)&&<p><b>Paradas:</b> {day.stops!.sort((a,b)=>a.order-b.order).map((stop)=>stop.name).join(" · ")}</p>}{settings.showMeals&&Boolean(day.meals?.length)&&<p><b>Alimentos:</b> {day.meals!.join(" · ")}</p>}{settings.showAccommodation&&day.accommodation&&<p><b>Hospedaje:</b> {day.accommodation}</p>}{settings.showHighlights&&Boolean(day.highlights?.length)&&<ul>{day.highlights!.map((item)=><li key={item}>{item}</li>)}</ul>}{settings.showImages&&day.images?.[0]&&<div className="explorer-program-image"><Image src={day.images[0].url} alt={day.images[0].alt} fill sizes="50vw" /></div>}</div>}</article>)}<ItineraryDownload agency={agency} trip={trip} /></section>;
}

function ConfigurableTripContent({ agency, trip, related, departureId, onDepartureChange, onNavigate }: { agency: Agency; trip: TravelProduct; related: TravelProduct[]; departureId: string; onDepartureChange: (id:string)=>void; onNavigate:(path:string)=>void }) {
  const departure = trip.departures.find((item)=>item.id===departureId) ?? available(trip);
  const sections=resolveTripSections(trip);
  const sticky=getStickyTripSections(trip);
  return <><nav className="explorer-detail-nav configurable" aria-label="Secciones del viaje">{sticky.map((section)=><a key={section.id} href={`#${section.id}`}>{section.anchorLabel??section.title??section.type}</a>)}</nav><div className="explorer-detail-grid configurable-grid"><article className="explorer-detail-content">{sections.filter((section)=>section.type!=="related_trips").map((section)=><ConfigurableTripSection key={section.id} section={section} agency={agency} trip={trip} departure={departure} onDepartureChange={onDepartureChange}/>)}</article><ExplorerBookingPanel agency={agency} trip={trip} selectedDepartureId={departureId} onDepartureChange={onDepartureChange}/></div>{sections.some((section)=>section.type==="related_trips")&&<section id={sections.find((section)=>section.type==="related_trips")?.id} className="explorer-related"><header><span className="section-label">SIGUE EXPLORANDO</span><h2>Rutas que también podrían llamarte.</h2></header><div>{related.map((item)=><ExplorerCard key={item.id} trip={item} onOpen={(selected)=>onNavigate(travelUrl(selected))}/>)}</div></section>}</>;
}

function ExplorerDetail({
  agency,
  trip,
  onNavigate,
}: {
  agency: Agency;
  trip: TravelProduct;
  onNavigate: (path: string) => void;
}) {
  const departure = available(trip);
  const [selectedDepartureId, setSelectedDepartureId] = useState(departure.id);
  const selectedDeparture = trip.departures.find((item) => item.id === selectedDepartureId) ?? departure;
  const selectedStartingPrice = getTripDisplayStartingPrice({ trip, departure: selectedDeparture });
  const related = travels
    .filter((item) => item.agencyId === agency.id && item.id !== trip.id)
    .slice(0, 3);
  const mode = availabilityMode(agency, trip);
  return (
    <main className="explorer-detail-refined">
      <section className="explorer-detail-cover">
        {trip.heroMedia?.type === "video" && trip.heroMedia.muted ? (
          <video className="trip-hero-video" autoPlay={trip.heroMedia.autoplay} muted loop={trip.heroMedia.loop} playsInline poster={trip.heroMedia.posterUrl}>
            <source src={trip.heroMedia.videoUrl} />
          </video>
        ) : (
          <Image
            src={trip.heroMedia?.type === "image" ? trip.heroMedia.imageUrl : trip.featuredImage}
            alt={trip.heroMedia?.type === "image" ? trip.heroMedia.imageAlt : `Paisaje de ${trip.cities[0]}`}
            fill priority sizes="100vw"
            style={trip.heroMedia?.type === "image" ? { objectPosition: `${trip.heroMedia.focalPoint?.x ?? 50}% ${trip.heroMedia.focalPoint?.y ?? 50}%` } : undefined}
          />
        )}
        <div className="explorer-detail-cover-shade" />
        <button
          className="explorer-breadcrumb"
          onClick={() => onNavigate("/viajes")}
        >
          Inicio / Viajes / {trip.cities[0]}
        </button>
        <div className="explorer-detail-title">
          <span>
            {productLabel(trip.productType)} · {trip.countries.join(", ")}
          </span>
          <h1>{trip.title}</h1>
          <p>{trip.subtitle}</p>
          <button
            onClick={() =>
              document
                .getElementById("reserva")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Reservar este viaje
          </button>
        </div>
        <div className="explorer-detail-price">
          <small>{trip.basePrice.displayFrom ? "Desde" : "Precio"}</small>
          <strong>
            {explorerPrice(selectedStartingPrice.amount, selectedStartingPrice.currency)}
          </strong>
          <span>
            {formatTripDuration(trip.durationDays, trip.durationNights)} · {dateLabel(selectedDeparture.startDate, true)}
          </span>
        </div>
      </section>
      {trip.pageConfiguration ? (
        <ConfigurableTripContent agency={agency} trip={trip} related={related} departureId={selectedDepartureId} onDepartureChange={setSelectedDepartureId} onNavigate={onNavigate} />
      ) : (
      <>
      <nav className="explorer-detail-nav" aria-label="Secciones del viaje">
        {[
          "Resumen",
          "Programa",
          "Incluye",
          "Salidas",
          "Tarifas",
          "Políticas",
        ].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`}>
            {item}
          </a>
        ))}
      </nav>
      <section className="explorer-detail-intro" id="resumen">
        <div>
          <span className="section-label">{trip.code} · RESUMEN</span>
          <h2>
            {trip.durationDays} días · {trip.durationNights} noches
          </h2>
          <p>
            {trip.description} {trip.summary}
          </p>
          <div className="explorer-next-dates">
            <b>Próximas salidas:</b>
            {trip.departures
              .filter((item) => item.saleStatus !== "sold_out")
              .slice(0, 3)
              .map((item) => (
                <a key={item.id} href="#reserva">
                  {dateLabel(item.startDate)}
                </a>
              ))}
          </div>
        </div>
      </section>
      <div className="explorer-detail-grid">
        <article className="explorer-detail-content">
          <ExplorerGallery trip={trip} />
          <section id="programa" className="explorer-program">
            <span className="section-label">PROGRAMA POR ETAPAS</span>
            <h2>El camino, día a día.</h2>
            {trip.itinerary.map((day, index) => (
              <details key={day.day} open={index === 0}>
                <summary>
                  <b>{String(day.day).padStart(2, "0")}</b>
                  <span>
                    <small>DÍA {day.day}</small>
                    {day.title}
                  </span>
                  <i>+</i>
                </summary>
                <div>
                  <p>{day.description}</p>
                  {index === 0 && (
                    <div className="explorer-program-image">
                      <Image
                        src={trip.featuredImage}
                        alt=""
                        fill
                        sizes="50vw"
                      />
                    </div>
                  )}
                </div>
              </details>
            ))}
          </section>
          <section id="incluye" className="explorer-includes-refined">
            <div>
              <h2>Incluye</h2>
              {trip.includes.map((item) => (
                <p key={item}>
                  <i>✓</i>
                  {item}
                </p>
              ))}
            </div>
            <div>
              <h2>No incluye</h2>
              {trip.excludes.map((item) => (
                <p key={item}>
                  <i>×</i>
                  {item}
                </p>
              ))}
            </div>
          </section>
          <section id="salidas" className="explorer-departures-refined">
            <span className="section-label">FECHAS DISPONIBLES</span>
            <h2>Elige cuándo partir.</h2>
            {trip.departures.map((item) => (
              <div key={item.id}>
                <time>{dateLabel(item.startDate, true)}</time>
                <span>
                  Desde{" "}
                  {explorerPrice(
                    item.priceOverride?.amount ?? trip.basePrice.amount,
                    item.priceOverride?.currency ?? trip.basePrice.currency,
                  )}
                </span>
                {mode === "remaining_places" && (
                  <small>{item.availableSpaces} lugares disponibles</small>
                )}
                <b>
                  {item.saleStatus === "sold_out"
                    ? "Agotada"
                    : item.saleStatus === "limited"
                      ? "Últimos lugares"
                      : "Programada"}
                </b>
                <a href="#reserva">Elegir fecha</a>
              </div>
            ))}
          </section>
          <section id="tarifas" className="explorer-rates">
            <span className="section-label">TARIFAS</span>
            <div
              className={`explorer-rate-grid ${trip.accommodationMode === "none" ? "is-traveler-rates" : ""}`}
            >
              {trip.pricingOptions
                .filter((rate) =>
                  explorerVisibleRateOccupancies(trip).includes(rate.occupancy),
                )
                .map((rate) => (
                  <div key={rate.id}>
                    <span>
                      <b>
                        {rate.occupancy === "general"
                          ? "Adulto"
                          : occupancyName(rate.occupancy)}
                      </b>
                      <small>
                        {trip.accommodationMode === "none"
                          ? `Tarifa por ${rate.occupancy === "general" ? "adulto" : occupancyName(rate.occupancy).toLowerCase()}`
                          : rate.occupancy === "child"
                            ? "Tarifa para menor según rango de edad"
                            : `Precio por adulto en base ${occupancyName(rate.occupancy).toLowerCase()}`}
                      </small>
                    </span>
                    <strong>{explorerPrice(rate.amount, rate.currency)}</strong>
                  </div>
                ))}
            </div>
            {trip.extraVisibility !== "hidden" &&
              trip.extras.some(
                (extra) =>
                  extra.optional &&
                  extra.price > 0 &&
                  extra.visibility !== "hidden",
              ) && (
                <>
                  <h3>Opcionales durante la reserva</h3>
                  <div className="explorer-extra-grid">
                    {trip.extras
                      .filter(
                        (extra) =>
                          extra.optional &&
                          extra.price > 0 &&
                          extra.visibility !== "hidden",
                      )
                      .map((extra) => (
                        <div key={extra.id}>
                          <span>
                            <b>{extra.name}</b>
                            <small>Selección opcional</small>
                          </span>
                          <strong>
                            {explorerPrice(extra.price, extra.currency)}
                          </strong>
                        </div>
                      ))}
                  </div>
                </>
              )}
          </section>
          <section id="políticas" className="explorer-policies">
            <span className="section-label">ANTES DE PARTIR</span>
            <h2>Políticas y preguntas.</h2>
            {Object.entries(trip.policies).map(([key, value]) => (
              <details key={key}>
                <summary>
                  {key === "cancellation"
                    ? "Cambios y cancelaciones"
                    : key === "payment"
                      ? "Pagos y anticipo"
                      : "Responsabilidad de operación"}
                  <i>+</i>
                </summary>
                <p>{value}</p>
              </details>
            ))}
            {[
              [
                "¿Cómo recibo la confirmación?",
                "Después de apartar recibirás el resumen de salida y los datos de seguimiento.",
              ],
              [
                "¿Puedo cambiar de punto de abordaje?",
                "Sí, mientras exista capacidad en el punto elegido y antes del cierre operativo.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <i>+</i>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </section>
        </article>
        <ExplorerBookingPanel agency={agency} trip={trip} />
      </div>
      <section className="explorer-related">
        <header>
          <span className="section-label">SIGUE EXPLORANDO</span>
          <h2>
            Rutas que también
            <br />
            podrían llamarte.
          </h2>
        </header>
        <div>
          {related.map((item) => (
            <ExplorerCard
              key={item.id}
              trip={item}
              onOpen={(selected) => onNavigate(travelUrl(selected))}
            />
          ))}
        </div>
      </section>
      </>
      )}
      <section
        className="explorer-detail-final"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(7,13,17,.94),rgba(7,13,17,.28)),url(/images/destination-mountain.webp)`,
        }}
      >
        <span>¿LISTO PARA PARTIR?</span>
        <h2>
          El siguiente capítulo
          <br />
          empieza en la carretera.
        </h2>
        <button
          onClick={() =>
            document
              .getElementById("reserva")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Configurar reserva ↗
        </button>
      </section>
    </main>
  );
}

export function TravelApp({
  hostname,
  initialTenant,
  initialTheme,
  initialPath = "/",
  customerProfile = null,
}: {
  hostname: string;
  initialTenant?: string;
  initialTheme?: string;
  initialPath?: string;
  customerProfile?: PublicCustomerCheckoutProfile | null;
}) {
  const customerEmail = customerProfile?.email ?? null;
  const [route, setRoute] = useState(initialPath);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const sync = () => {
      setRoute(currentPath());
      setVersion((value) => value + 1);
    };
    sync();
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  const params = useMemo(() => {
    void version;
    return currentParams();
  }, [version]);
  const agency = resolveTenant(hostname, params.get("tenant") ?? initialTenant);
  const theme = resolveTheme(agency, params.get("theme") ?? initialTheme);
  const ownTrips = travels.filter((trip) => trip.agencyId === agency.id);
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    try {
      setCartCount(
        (
          JSON.parse(
            localStorage.getItem("fu-travel-demo-cart") ?? "[]",
          ) as CartLine[]
        ).length,
      );
    } catch {
      setCartCount(0);
    }
  }, [route, version]);
  const navigate = (next: string) => {
    const separator = next.includes("?") ? "&" : "?";
    const demo = new URLSearchParams({ tenant: agency.slug, theme });
    window.history.pushState({}, "", `${next}${separator}${demo}`);
    setRoute(currentPath());
    setVersion((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeDemo = (key: string, value: string) => {
    const next = currentParams();
    next.set(key, value);
    localStorage.setItem(`fu-travel-demo-${key}`, value);
    if (key === "view" && value === "admin")
      window.location.href = `/demo/admin?${next}`;
    else {
      window.history.replaceState({}, "", `${route}?${next}`);
      setVersion((item) => item + 1);
    }
  };
  if (
    route.startsWith("/demo/admin") ||
    route.startsWith("/superadmin") ||
    ["/carrito", "/checkout", "/confirmacion"].includes(route)
  )
    return (
      <>
        <LegacyTravelApp
          hostname={hostname}
          initialTenant={agency.slug}
          initialTheme={theme}
          initialPath={route}
          customerEmail={customerEmail}
          customerProfile={customerProfile}
        />
        {theme === "explorer" &&
          !route.startsWith("/admin") &&
          !route.startsWith("/superadmin") && (
            <ExplorerWhatsApp agency={agency} />
          )}
      </>
    );
  const components = themeRenderers[theme];
  const trip = ownTrips.find((item) => route === travelUrl(item));
  const content = trip ? (
    theme === "explorer" ? (
      <ExplorerDetail agency={agency} trip={trip} onNavigate={navigate} />
    ) : (
      <LavellaTripDetail
        agency={agency}
        trip={trip}
        related={ownTrips.filter((item) => item.id !== trip.id)}
        onNavigate={navigate}
      />
    )
  ) : route === "/viajes" || route === "/promociones" ? (
    theme === "lavella" ? (
      <LavellaCatalog agency={agency} trips={ownTrips} onOpen={(item) => navigate(travelUrl(item))} />
    ) : (
      <ExplorerCatalog agency={agency} onOpen={(item) => navigate(travelUrl(item))} />
    )
  ) : route === "/destinos" ? (
    theme === "lavella" ? (
      <LavellaCatalog agency={agency} trips={ownTrips} onOpen={(item) => navigate(travelUrl(item))} />
    ) : (
      <ExplorerCatalog agency={agency} onOpen={(item) => navigate(travelUrl(item))} />
    )
  ) : (
    <components.Home
      agency={agency}
      trips={ownTrips}
      onOpen={(item) => navigate(travelUrl(item))}
      onNavigate={navigate}
    />
  );
  return (
    <div
      className={`visual-v2 theme-v2-${theme} ${theme === "lavella" && trip ? "lavella-detail-route" : ""}`}
      style={
        {
          "--brand": agency.branding.primaryColor,
          "--accent": agency.branding.accentColor,
        } as React.CSSProperties
      }
    >
      <components.Header
        agency={agency}
        cartCount={cartCount}
        onNavigate={navigate}
        customerEmail={customerEmail}
      />
      {content}
      <components.Footer agency={agency} onNavigate={navigate} />
      {theme === "explorer" && <ExplorerWhatsApp agency={agency} trip={trip} />}
      <DemoControls agency={agency} theme={theme} onChange={changeDemo} />
    </div>
  );
}
