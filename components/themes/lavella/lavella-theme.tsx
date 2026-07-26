"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBars,
  FaCartShopping,
  FaChevronRight,
  FaInstagram,
  FaWhatsapp,
  FaXmark,
} from "react-icons/fa6";
import { formatMoney } from "@/lib/pricing";
import { getTripDisplayStartingPrice } from "@/lib/trip-sections";
import type { Agency, TravelProduct } from "@/types";

export const lavellaTokens = {
  colors: {
    background: "#f7f7f5",
    surface: "#ffffff",
    surfaceDark: "#252a35",
    text: "#3e4559",
    textMuted: "#818693",
    accent: "#ff7f00",
    accentHover: "#e76f00",
    border: "#e6e6e6",
  },
  typography: { heading: "var(--font-explorer)", body: "var(--font-explorer)" },
  radius: { small: "2px", medium: "8px", large: "18px" },
  spacing: { section: "clamp(72px, 9vw, 132px)", container: "min(1180px, 92vw)" },
} as const;

type HeaderProps = {
  agency: Agency;
  cartCount: number;
  onNavigate: (path: string) => void;
};
type HomeProps = {
  agency: Agency;
  trips: TravelProduct[];
  onOpen: (trip: TravelProduct) => void;
  onNavigate: (path: string) => void;
};
type CardProps = { trip: TravelProduct; onOpen: (trip: TravelProduct) => void };
type FooterProps = { agency: Agency; onNavigate: (path: string) => void };

const nav = [
  ["Viajes", "/viajes"],
  ["Destinos", "/destinos"],
  ["Promociones", "/promociones"],
  ["Nosotros", "/nosotros"],
] as const;

const nextDeparture = (trip: TravelProduct) =>
  [...trip.departures]
    .filter((departure) => departure.saleStatus !== "sold_out")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ??
  trip.departures[0];

const dateLabel = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
      })
    : "Por confirmar";

const lavellaWhatsApp = (agency: Agency, trip?: TravelProduct, currentUrl?: string) => {
  const message = [
    `Hola ${agency.name}, necesito ayuda para reservar${trip ? ` “${trip.title}”` : " un viaje"}.`,
    currentUrl ? `Enlace: ${currentUrl}` : "",
  ].filter(Boolean).join("\n\n");
  return `https://wa.me/${agency.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
};
const openLavellaWhatsApp = (
  event: MouseEvent<HTMLAnchorElement>,
  agency: Agency,
  trip?: TravelProduct,
) => {
  event.preventDefault();
  window.open(lavellaWhatsApp(agency, trip, window.location.href), "_blank", "noopener,noreferrer");
};

export function LavellaHeader({ agency, cartCount, onNavigate }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setSolid(window.scrollY > 28);
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const focusable = [...(drawer.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    addEventListener("keydown", escape);
    requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>("button")?.focus());
    return () => {
      document.body.style.overflow = previous;
      removeEventListener("keydown", escape);
      trigger.current?.focus();
    };
  }, [open]);
  const go = (path: string) => {
    setOpen(false);
    onNavigate(path);
  };
  return (
    <>
      <header className={`lavella-header ${solid ? "is-solid" : ""}`}>
        <button className="lavella-logo" onClick={() => go("/")} aria-label={`Inicio de ${agency.name}`}>
          <b>{agency.branding.logoText}</b>
          <small>VIAJES CON PROPÓSITO</small>
        </button>
        <nav aria-label="Navegación principal">
          {nav.map(([label, path]) => <button key={path} onClick={() => go(path)}>{label}</button>)}
        </nav>
        <div className="lavella-header-actions">
          <a href={lavellaWhatsApp(agency)} onClick={(event) => openLavellaWhatsApp(event, agency)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${agency.name}`}><FaWhatsapp /></a>
          <button onClick={() => go("/carrito")} aria-label={`Carrito, ${cartCount} viajes`}><FaCartShopping /><span>{cartCount}</span></button>
          <button className="lavella-header-cta" onClick={() => go("/viajes")}>Explorar viajes</button>
          <button ref={trigger} className="lavella-menu-trigger" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="lavella-mobile-menu" aria-label="Abrir menú"><FaBars /></button>
        </div>
      </header>
      {open && (
        <div ref={drawer} id="lavella-mobile-menu" className="lavella-drawer" role="dialog" aria-modal="true" aria-label="Menú principal">
          <div className="lavella-drawer-top">
            <span>{agency.branding.logoText}</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú"><FaXmark /></button>
          </div>
          <nav>
            {nav.map(([label, path], index) => <button key={path} onClick={() => go(path)}><small>0{index + 1}</small>{label}<FaChevronRight /></button>)}
            <button onClick={() => go("/carrito")}><small>05</small>Carrito ({cartCount})<FaChevronRight /></button>
          </nav>
          <div className="lavella-drawer-contact">
            <p>Diseñamos rutas que se recuerdan mucho después del regreso.</p>
            <a href={lavellaWhatsApp(agency)} onClick={(event) => openLavellaWhatsApp(event, agency)} target="_blank" rel="noreferrer"><FaWhatsapp /> Consultar por WhatsApp</a>
          </div>
        </div>
      )}
    </>
  );
}

export function LavellaCard({ trip, onOpen }: CardProps) {
  const departure = nextDeparture(trip);
  const price = getTripDisplayStartingPrice({ trip, departure });
  return (
    <article className="lavella-card">
      <button className="lavella-card-image" onClick={() => onOpen(trip)} aria-label={`Ver ${trip.title}`}>
        <Image src={trip.featuredImage} alt="" fill sizes="(max-width: 720px) 92vw, 33vw" />
        {trip.promotion && <span>{trip.promotion}</span>}
      </button>
      <div className="lavella-card-body">
        <small>{trip.countries.join(" · ")}</small>
        <h3>{trip.title}</h3>
        <div>
          <span>{trip.durationDays} días</span>
          <span>{dateLabel(departure?.startDate)}</span>
        </div>
        <footer>
          <p><small>DESDE</small><strong>{formatMoney(price.amount, price.currency)}</strong></p>
          <button onClick={() => onOpen(trip)} aria-label={`Ver más de ${trip.title}`}><FaArrowRight /></button>
        </footer>
      </div>
    </article>
  );
}

export function LavellaHome({ agency, trips, onOpen, onNavigate }: HomeProps) {
  const slides = trips.slice(0, Math.min(4, trips.length));
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    if (paused || slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [paused, slides.length]);
  const move = (direction: number) => {
    setPaused(true);
    setActive((value) => (value + direction + slides.length) % slides.length);
  };
  const featured = slides[active] ?? trips[0];
  if (!featured) return null;
  const departure = nextDeparture(featured);
  const price = getTripDisplayStartingPrice({ trip: featured, departure });
  return (
    <main className="lavella-home">
      <section className="lavella-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX;
        if (touchStart.current != null && end != null && Math.abs(end - touchStart.current) > 45) move(end < touchStart.current ? 1 : -1);
        touchStart.current = null;
      }}>
        {slides.map((trip, index) => <Image key={trip.id} className={index === active ? "is-active" : ""} src={trip.featuredImage} alt="" fill priority={index === 0} sizes="100vw" />)}
        <div className="lavella-hero-shade" />
        <div className="lavella-hero-copy">
          <p><span>{String(active + 1).padStart(2, "0")}</span>{featured.categoryIds[0]?.replaceAll("_", " ") ?? "Experiencia"}</p>
          <h1>{featured.title}</h1>
          <p className="lavella-hero-description">{featured.subtitle || featured.summary}</p>
          <div className="lavella-hero-meta">
            <p><small>DESDE</small><strong>{formatMoney(price.amount, price.currency)}</strong></p>
            <p><small>DURACIÓN</small><b>{featured.durationDays} días</b></p>
            <p><small>PRÓXIMA SALIDA</small><b>{dateLabel(departure?.startDate)}</b></p>
          </div>
          <div className="lavella-hero-actions">
            <button onClick={() => onOpen(featured)}>Ver viaje <FaArrowRight /></button>
            <a href={lavellaWhatsApp(agency, featured)} onClick={(event) => openLavellaWhatsApp(event, agency, featured)} target="_blank" rel="noreferrer"><FaWhatsapp /> WhatsApp</a>
          </div>
        </div>
        <div className="lavella-slider-controls" aria-label="Controles del carrusel">
          <button onClick={() => move(-1)} aria-label="Viaje anterior"><FaArrowLeft /></button>
          <span>{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          <div>{slides.map((trip, index) => <button key={trip.id} className={index === active ? "is-active" : ""} onClick={() => { setPaused(true); setActive(index); }} aria-label={`Mostrar viaje ${index + 1}`} aria-current={index === active ? "true" : undefined} />)}</div>
          <button onClick={() => move(1)} aria-label="Viaje siguiente"><FaArrowRight /></button>
        </div>
      </section>
      <form className="lavella-search" onSubmit={(event) => { event.preventDefault(); onNavigate("/viajes"); }}>
        <label>Destino<input name="destination" placeholder="¿A dónde quieres ir?" /></label>
        <label>Experiencia<select defaultValue=""><option value="">Todas las experiencias</option><option>Naturaleza</option><option>Cultura</option><option>Aventura</option></select></label>
        <label>Fecha<input type="month" name="month" /></label>
        <button>Buscar viajes</button>
      </form>
      <section className="lavella-featured">
        <header><div><small>VIAJES DESTACADOS</small><h2>Rutas elegidas para salir de lo cotidiano.</h2></div><button onClick={() => onNavigate("/viajes")}>Ver todos <FaArrowRight /></button></header>
        <div>{trips.slice(0, 6).map((trip) => <LavellaCard key={trip.id} trip={trip} onOpen={onOpen} />)}</div>
      </section>
      <section className="lavella-editorial">
        <div className="lavella-editorial-image"><Image src={trips[1]?.featuredImage ?? featured.featuredImage} alt="" fill sizes="50vw" /></div>
        <div><small>NUESTRA FORMA DE VIAJAR</small><h2>La distancia importa menos que lo que sucede en el camino.</h2><p>{agency.branding.heroDescription}</p><div className="lavella-editorial-stats"><span><b>{trips.length}</b>rutas activas</span><span><b>{trips.reduce((sum, trip) => sum + trip.departures.length, 0)}</b>salidas programadas</span></div><button onClick={() => onNavigate("/nosotros")}>Conocer la agencia</button></div>
      </section>
      <section className="lavella-destinations">
        <header><small>DESTINOS POPULARES</small><h2>Un mapa de próximas historias.</h2></header>
        <div>{trips.slice(0, 4).map((trip, index) => <button key={trip.id} className={index === 0 ? "is-large" : ""} onClick={() => onOpen(trip)}><Image src={trip.featuredImage} alt="" fill sizes={index === 0 ? "55vw" : "30vw"} /><span><small>{trip.countries.join(" · ")}</small><b>{trip.cities[0] ?? trip.title}</b><em>{trip.departures.length} salidas</em></span></button>)}</div>
      </section>
      <section className="lavella-home-cta"><small>EL VIAJE EMPIEZA AQUÍ</small><h2>Cuéntanos qué quieres vivir.</h2><a href={lavellaWhatsApp(agency)} onClick={(event) => openLavellaWhatsApp(event, agency)} target="_blank" rel="noreferrer"><FaWhatsapp /> Hablar con un asesor</a></section>
    </main>
  );
}

export function LavellaFooter({ agency, onNavigate }: FooterProps) {
  return (
    <footer className="lavella-footer">
      <div><button className="lavella-logo" onClick={() => onNavigate("/")}><b>{agency.branding.logoText}</b><small>VIAJES CON PROPÓSITO</small></button><p>Rutas cuidadas, información clara y acompañamiento antes, durante y después del viaje.</p></div>
      <nav><b>Explora</b>{nav.map(([label, path]) => <button key={path} onClick={() => onNavigate(path)}>{label}</button>)}</nav>
      <div><b>Contacto</b><a href={`mailto:${agency.contact.email}`}>{agency.contact.email}</a><a href={lavellaWhatsApp(agency)} onClick={(event) => openLavellaWhatsApp(event, agency)} target="_blank" rel="noreferrer">WhatsApp</a><span><FaInstagram /> Redes de {agency.name}</span></div>
      <div className="lavella-footer-bottom"><span>© 2026 {agency.name}</span><button>Aviso de privacidad</button><button>Términos</button><small>Demostración · Sin pagos reales</small></div>
    </footer>
  );
}
