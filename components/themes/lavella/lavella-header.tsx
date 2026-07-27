"use client";

import { useEffect, useRef, useState } from "react";
import {
  FaCartShopping,
  FaFacebookF,
  FaInstagram,
  FaMagnifyingGlass,
  FaWhatsapp,
} from "react-icons/fa6";
import styles from "./lavella-layout.module.css";
import { LavellaMobileMenu } from "./lavella-mobile-menu";
import type { LavellaHeaderProps } from "./lavella-types";
import { lavellaWhatsApp, openLavellaWhatsApp } from "./lavella-utils";

const navigation = [
  ["Inicio", "/"],
  ["Viajes", "/viajes"],
  ["Destinos", "/destinos"],
  ["Promociones", "/promociones"],
  ["Nosotros", "/nosotros"],
] as const;

export function LavellaHeader({
  agency,
  cartCount,
  onNavigate,
}: LavellaHeaderProps) {
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => setSolid(scrollY > 44);
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return (
    <>
      <header className={`${styles.header} ${solid ? styles.headerSolid : ""}`}>
        <div className={styles.headerInner}>
          <div className={styles.topbar}>
            <div>
              <a href={`tel:${agency.contact.phone ?? agency.contact.whatsapp}`}>
                {agency.contact.phone ?? agency.contact.whatsapp}
              </a>
              <a href={`mailto:${agency.contact.email}`}>{agency.contact.email}</a>
            </div>
            <div className={styles.socials}>
              <a href={agency.contact.facebook ?? "#"} aria-label="Facebook"><FaFacebookF /></a>
              <a href={agency.contact.instagram ?? "#"} aria-label="Instagram"><FaInstagram /></a>
              <a
                href={lavellaWhatsApp(agency)}
                onClick={(event) => openLavellaWhatsApp(event, agency)}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
              >
                <FaWhatsapp />
              </a>
            </div>
          </div>
          <div className={styles.navbar}>
            <button className={styles.logo} onClick={() => onNavigate("/")}>
              {agency.branding.logoText.toLowerCase()}
            </button>
            <nav aria-label="Navegación principal">
              {navigation.map(([label, path], index) => (
                <button
                  className={index === 0 ? styles.current : ""}
                  key={path}
                  onClick={() => onNavigate(path)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className={styles.navActions}>
              <button onClick={() => onNavigate("/viajes")} aria-label="Buscar viajes">
                <FaMagnifyingGlass />
              </button>
              <button onClick={() => onNavigate("/carrito")} aria-label={`Carrito, ${cartCount} elementos`}>
                <FaCartShopping />
                {cartCount > 0 && <b>{cartCount}</b>}
              </button>
              <button
                ref={triggerRef}
                className={styles.menuButton}
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="lavella-side-menu"
                aria-label="Abrir menú"
              >
                <i />
                <i />
                <i />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div id="lavella-side-menu">
        <LavellaMobileMenu
          agency={agency}
          cartCount={cartCount}
          onNavigate={onNavigate}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={triggerRef}
        />
      </div>
    </>
  );
}
