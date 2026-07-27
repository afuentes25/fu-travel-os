"use client";

import { FaFacebookF, FaInstagram, FaWhatsapp, FaYoutube } from "react-icons/fa6";
import type { LavellaFooterProps } from "./lavella-types";
import styles from "./lavella-layout.module.css";
import { lavellaWhatsApp, openLavellaWhatsApp } from "./lavella-utils";

const topNav = [["Inicio", "/"], ["Viajes", "/viajes"], ["Destinos", "/destinos"], ["Promociones", "/promociones"], ["Contacto", "/contacto"]] as const;

export function LavellaFooter({ agency, onNavigate }: LavellaFooterProps) {
  return <footer className={styles.footer}>
    <div className={styles.footerTop}>
      <button className={styles.footerLogo} onClick={() => onNavigate("/")}>{agency.branding.logoText.toLowerCase()}</button>
      <nav>{topNav.map(([label, path]) => <button key={path} onClick={() => onNavigate(path)}>{label}</button>)}</nav>
      <div><a href={agency.contact.instagram ? `https://instagram.com/${agency.contact.instagram.replace(/^@/, "")}` : "#"} aria-label="Instagram"><FaInstagram /></a><a href="#" aria-label="Facebook"><FaFacebookF /></a><a href="#" aria-label="YouTube"><FaYoutube /></a></div>
    </div>
    <div className={styles.footerGrid}>
      <section><h3>Descubre</h3><button onClick={() => onNavigate("/viajes")}>Próximas salidas</button><button onClick={() => onNavigate("/destinos")}>Destinos</button><button onClick={() => onNavigate("/promociones")}>Promociones</button></section>
      <section><h3>Información</h3><button onClick={() => onNavigate("/nosotros")}>Nosotros</button><button onClick={() => onNavigate("/contacto")}>Contacto</button><button>Aviso de privacidad</button><button>Términos</button></section>
      <section><h3>Contacto</h3><a href={`tel:${agency.contact.phone ?? agency.contact.whatsapp}`}>{agency.contact.phone ?? agency.contact.whatsapp}</a><a href={`mailto:${agency.contact.email}`}>{agency.contact.email}</a><span>Atención personalizada en cada salida</span></section>
      <section><h3>Planea tu viaje</h3><p>Cuéntanos qué ruta tienes en mente y te ayudamos a elegir la mejor salida.</p><a className={styles.footerWhatsApp} href={lavellaWhatsApp(agency)} onClick={(event) => openLavellaWhatsApp(event, agency)} target="_blank" rel="noreferrer"><FaWhatsapp /> Hablar por WhatsApp</a></section>
    </div>
    <div className={styles.footerBottom}><span>© 2026 {agency.name}</span><span>Fu Travel OS · Demostración</span></div>
  </footer>;
}
