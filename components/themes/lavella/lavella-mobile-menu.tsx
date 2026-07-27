"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FaCartShopping, FaInstagram, FaWhatsapp } from "react-icons/fa6";
import styles from "./lavella-layout.module.css";
import type { LavellaHeaderProps } from "./lavella-types";
import { lavellaWhatsApp, openLavellaWhatsApp } from "./lavella-utils";

const items = [
  ["Inicio", "/"],
  ["Viajes", "/viajes"],
  ["Destinos", "/destinos"],
  ["Promociones", "/promociones"],
  ["Nosotros", "/nosotros"],
  ["Contacto", "/contacto"],
] as const;

export function LavellaMobileMenu({
  agency,
  cartCount,
  onNavigate,
  open,
  onClose,
  triggerRef,
}: LavellaHeaderProps & {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "button,a[href]:not([tabindex='-1'])",
        ),
      ];
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
      document.body.style.overflow = before;
      removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);
  if (!open) return null;
  const go = (path: string) => {
    onClose();
    onNavigate(path);
  };
  return (
    <div className={styles.mobileOverlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        className={styles.mobileMenu}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        <header>
          <button className={styles.mobileLogo} onClick={() => go("/")}>
            {agency.branding.logoText.toLowerCase()}
          </button>
          <button className={styles.mobileClose} onClick={onClose} aria-label="Cerrar menú">
            <img src="/themes/lavella/menu-close.svg" alt="" />
          </button>
        </header>
        <nav>
          {items.map(([label, path]) => (
            <button key={path} onClick={() => go(path)}>
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.mobileContact}>
          <button onClick={() => go("/carrito")}>
            <FaCartShopping /> Carrito <b>{cartCount}</b>
          </button>
          <a
            href={lavellaWhatsApp(agency)}
            onClick={(event) => openLavellaWhatsApp(event, agency)}
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp /> WhatsApp
          </a>
          <span>
            <FaInstagram /> {agency.contact.instagram ?? agency.name}
          </span>
        </div>
      </aside>
    </div>
  );
}
