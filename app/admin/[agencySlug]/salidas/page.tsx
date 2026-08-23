import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { listAdminDepartures } from "@/lib/departures/admin-departure-manifest";

import { AdminShell } from "../../admin-shell";
import styles from "../../admin.module.css";
import manifestStyles from "./manifest.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function date(value: string | null, departureTime: string | null) {
  if (!value) return "Fecha de salida no disponible";
  const parsed = new Date(value);
  const label = Number.isNaN(parsed.getTime()) ? "Fecha de salida no disponible" : parsed.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return departureTime ? `${label} · ${departureTime}` : label;
}

export default async function AdminDeparturesPage({ params }: Readonly<{ params: Promise<{ agencySlug: string }> }>) {
  noStore();
  const { agencySlug } = await params;
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try { access = await resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug }); }
  catch { return <AdminShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar las salidas</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>; }
  if (access.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/salidas`)}`);
  if (access.status === "selection_required") redirect("/admin");
  if (access.status === "forbidden") return <AdminShell><section className={styles.stateCard}><h1>Acceso no autorizado</h1><p>No tienes permiso para consultar las salidas de esta agencia.</p></section></AdminShell>;
  const result = await listAdminDepartures({ requestedAgencySlug: access.agency.agencySlug });
  if (result.status !== "authorized") return <AdminShell agency={access.agency} memberships={access.memberships}><section className={styles.stateCard} role="alert"><h1>No fue posible cargar las salidas</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>;
  return <AdminShell agency={access.agency} memberships={access.memberships}><main className={`${styles.content} ${manifestStyles.page}`} aria-labelledby="departures-title"><header className={manifestStyles.heading}><div><span className={manifestStyles.eyebrow}>Operación</span><h1 id="departures-title">Salidas</h1><p>Consulta el manifiesto operativo de cada salida y el avance de check-in y abordaje.</p></div><Link className={manifestStyles.scannerLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/abordaje`}>Abrir control de abordaje</Link></header>{result.departures.length === 0 ? <section className={manifestStyles.emptyState}><h2>Aún no hay próximas salidas con reservaciones.</h2><p>Las salidas aparecerán aquí cuando existan reservaciones asociadas.</p></section> : <section className={manifestStyles.departureList} aria-label="Próximas salidas">{result.departures.map((departure) => <Link className={manifestStyles.departureCard} key={departure.key} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/salidas/${encodeURIComponent(departure.key)}`}><div><span className={manifestStyles.eyebrow}>{departure.tourCode ?? "Salida"}</span><h2>{departure.tourName ?? "Tour no disponible"}</h2><p className={manifestStyles.departureDate}>{date(departure.departureDate, departure.departureTime)}</p></div><div className={manifestStyles.departureMetrics}><div><span>Reservaciones</span><strong>{departure.summary.reservations}</strong></div><div><span>Pasajeros</span><strong>{departure.summary.travelers}</strong></div><div><span>Check-in</span><strong>{departure.summary.checkInCompleted} / {departure.summary.travelers}</strong></div><div><span>Abordados</span><strong>{departure.summary.boarded} / {departure.summary.travelers}</strong></div></div></Link>)}</section>}</main></AdminShell>;
}
