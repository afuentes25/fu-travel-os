import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { getAdminDepartureManifest } from "@/lib/departures/admin-departure-manifest";

import { AdminShell } from "../../../admin-shell";
import styles from "../../../admin.module.css";
import manifestStyles from "../manifest.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS = [
  ["all", "Todos"], ["pending", "Pendientes"], ["checked_in", "Check-in"], ["boarded", "Abordados"], ["without_ticket", "Sin boleto"],
] as const;

function date(value: string | null, departureTime: string | null = null) {
  if (!value) return "Fecha de salida no disponible";
  const parsed = new Date(value);
  const label = Number.isNaN(parsed.getTime()) ? "Fecha de salida no disponible" : parsed.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return departureTime ? `${label} · ${departureTime}` : label;
}

function stateLabel(value: "pending" | "checked_in" | "boarded") {
  return value === "boarded" ? "Abordado" : value === "checked_in" ? "Check-in realizado" : "Pendiente";
}

function queryUrl(base: string, filter: string, search: string) {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("estado", filter);
  if (search) query.set("q", search);
  const value = query.toString();
  return value ? `${base}?${value}` : base;
}

export default async function AdminDepartureManifestPage({ params, searchParams }: Readonly<{ params: Promise<{ agencySlug: string; departureKey: string }>; searchParams: Promise<{ estado?: string; q?: string }> }>) {
  noStore();
  const { agencySlug, departureKey } = await params;
  const query = await searchParams;
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try { access = await resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug }); }
  catch { return <AdminShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar el manifiesto</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>; }
  if (access.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/salidas/${departureKey}`)}`);
  if (access.status === "selection_required") redirect("/admin");
  if (access.status === "forbidden") return <AdminShell><section className={styles.stateCard}><h1>Acceso no autorizado</h1><p>No tienes permiso para consultar este manifiesto.</p></section></AdminShell>;
  const result = await getAdminDepartureManifest({ requestedAgencySlug: access.agency.agencySlug, departureKey, filter: query.estado, search: query.q });
  if (result.status === "not_found") return <AdminShell agency={access.agency} memberships={access.memberships}><section className={styles.stateCard}><h1>Salida no disponible</h1><p>No encontramos una salida disponible para esta agencia.</p><Link className={manifestStyles.backLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/salidas`}>Volver a Salidas</Link></section></AdminShell>;
  if (result.status !== "authorized") return <AdminShell agency={access.agency} memberships={access.memberships}><section className={styles.stateCard} role="alert"><h1>No fue posible cargar el manifiesto</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>;
  const base = `/admin/${encodeURIComponent(access.agency.agencySlug)}/salidas/${encodeURIComponent(result.manifest.departure.key)}`;
  const groups = new Map<string, typeof result.visibleTravelers>();
  for (const traveler of result.visibleTravelers) { const name = traveler.boardingPoint ?? "Punto de abordaje no disponible"; groups.set(name, [...(groups.get(name) ?? []), traveler]); }
  return <AdminShell agency={access.agency} memberships={access.memberships}><main className={`${styles.content} ${manifestStyles.page}`} aria-labelledby="manifest-title"><Link className={manifestStyles.backLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/salidas`}>← Volver a Salidas</Link><header className={manifestStyles.manifestHero}><div><span className={manifestStyles.eyebrow}>{result.manifest.departure.tourCode ?? "Salida"}</span><h1 id="manifest-title">{result.manifest.departure.tourName ?? "Tour no disponible"}</h1><p>{date(result.manifest.departure.departureDate)}</p></div><Link className={manifestStyles.scannerLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/abordaje`}>Abrir control de abordaje</Link></header><section className={manifestStyles.metricGrid} aria-label="Resumen operativo"><div><span>Pasajeros</span><strong>{result.manifest.summary.travelers}</strong></div><div><span>Check-in completado</span><strong>{result.manifest.summary.checkInCompleted} / {result.manifest.summary.travelers}</strong></div><div><span>Abordados</span><strong>{result.manifest.summary.boarded} / {result.manifest.summary.travelers}</strong></div><div><span>Pendientes</span><strong>{result.manifest.summary.pending}</strong></div></section>{result.manifest.summary.travelers > 0 && result.manifest.summary.boarded === result.manifest.summary.travelers && <p className={manifestStyles.completed} role="status">Abordaje completo</p>}<section className={manifestStyles.manifestToolbar} aria-label="Buscar y filtrar manifiesto"><form className={manifestStyles.searchForm}><label className="sr-only" htmlFor="manifest-search">Buscar pasajero o folio</label><input id="manifest-search" name="q" defaultValue={result.search} placeholder="Buscar pasajero o folio" /><input type="hidden" name="estado" value={result.filter === "all" ? "" : result.filter} /><button type="submit">Buscar</button></form><nav className={manifestStyles.filters} aria-label="Filtrar pasajeros">{FILTERS.map(([filter, label]) => <Link key={filter} className={result.filter === filter ? manifestStyles.filterActive : undefined} href={queryUrl(base, filter, result.search)}>{label}</Link>)}</nav></section><section className={manifestStyles.manifestSection} aria-label="Pasajeros del manifiesto">{groups.size === 0 ? <p className={manifestStyles.emptyRows}>No hay pasajeros que coincidan con este filtro.</p> : [...groups.entries()].map(([boardingPoint, travelers]) => <section className={manifestStyles.boardingGroup} key={boardingPoint}><h2>{boardingPoint}</h2><div className={manifestStyles.travelerRows}>{travelers.map((traveler) => <article className={manifestStyles.travelerRow} key={`${traveler.reservationCode}-${traveler.position}`}><div className={manifestStyles.travelerIdentity}><strong>{traveler.name}</strong><span>{traveler.travelerType === "adult" ? "Adulto" : "Menor"} · Reservación {traveler.reservationCode}</span></div><div><span className={manifestStyles.cellLabel}>Boleto</span><span className={`${manifestStyles.badge} ${traveler.ticketStatus === "available" ? "" : manifestStyles.badge}`} data-state={traveler.ticketStatus}>{traveler.ticketStatus === "available" ? "Disponible" : "Sin boleto vigente"}</span>{traveler.ticketStatus === "available" && traveler.credentialStatus === "unavailable" && <span className={manifestStyles.secondary}>Sin credencial de abordaje</span>}</div><div><span className={manifestStyles.cellLabel}>Check-in</span><span className={manifestStyles.badge} data-state={traveler.boardingStatus}>{traveler.boardingStatus === "pending" ? "Pendiente" : "Realizado"}</span></div><div><span className={manifestStyles.cellLabel}>Abordaje</span><span className={manifestStyles.badge} data-state={traveler.boardingStatus}>{traveler.boardingStatus === "boarded" ? "Abordado" : "Pendiente"}</span></div><div><span className={manifestStyles.cellLabel}>Estado</span><span>{stateLabel(traveler.boardingStatus)}</span></div></article>)}</div></section>)}</section></main></AdminShell>;
}
