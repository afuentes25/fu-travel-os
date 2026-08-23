import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import { AdminShell } from "../../admin-shell";
import styles from "../../admin.module.css";
import { BoardingControl } from "./boarding-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminBoardingPage({ params }: Readonly<{ params: Promise<{ agencySlug: string }> }>) {
  noStore();
  const { agencySlug } = await params;
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try { access = await resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug }); }
  catch { return <AdminShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar el control de abordaje</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>; }
  if (access.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/abordaje`)}`);
  if (access.status === "selection_required") redirect("/admin");
  if (access.status === "forbidden") return <AdminShell><section className={styles.stateCard}><h1>Acceso no autorizado</h1><p>No tienes permiso para operar abordaje en esta agencia.</p></section></AdminShell>;
  return <AdminShell agency={access.agency} memberships={access.memberships}><section className={styles.content} aria-labelledby="boarding-page-title"><div className={styles.heading}><div><span className={styles.kicker}>Operación móvil</span><h1 id="boarding-page-title">Control de abordaje</h1><p>Valida el boleto y registra cada transición de forma explícita.</p></div></div><BoardingControl agencySlug={access.agency.agencySlug}/></section></AdminShell>;
}
