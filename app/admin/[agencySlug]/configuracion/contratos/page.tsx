import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContractSettings } from "@/lib/contracts/admin-contract-settings";

import { AdminShell } from "../../../admin-shell";
import styles from "../../../admin.module.css";
import { ContractTemplateManager, LegalProfileForm } from "./contract-settings-forms";
import settingsStyles from "./contract-settings.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminContractSettingsPage({ params }: Readonly<{ params: Promise<{ agencySlug: string }> }>) {
  noStore();
  const { agencySlug } = await params;
  let result: Awaited<ReturnType<typeof getAdminContractSettings>>;
  try { result = await getAdminContractSettings({ requestedAgencySlug: agencySlug }); }
  catch { return <AdminShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar la configuración contractual</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>; }
  if (result.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/configuracion/contratos`)}`);
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "forbidden") return <AdminShell><section className={styles.stateCard}><h1>Acceso no autorizado</h1><p>No tienes permiso para administrar esta sección.</p></section></AdminShell>;
  const { agency, settings } = result;
  return <AdminShell agency={agency.agency} memberships={agency.memberships}><main className={settingsStyles.settings}>
    <header className={settingsStyles.heading}><span className={styles.kicker}>Configuración</span><h1>Contratos</h1><p>Configura los datos legales y prepara las plantillas que se utilizarán posteriormente para generar contratos de tus reservaciones.</p></header>
    <section className={settingsStyles.section} aria-labelledby="legal-profile-title"><h2 id="legal-profile-title">Datos legales de la agencia</h2><p className={settingsStyles.sectionIntro}>{settings.legalProfile ? "Actualiza los datos reales que se utilizarán posteriormente en contratos." : "Completa los datos legales de la agencia antes de preparar tu contrato."}</p><LegalProfileForm agencySlug={agency.agency.agencySlug} profile={settings.legalProfile} /></section>
    <section className={settingsStyles.section} aria-labelledby="contract-templates-title"><h2 id="contract-templates-title">Plantillas de contrato</h2><p className={settingsStyles.sectionIntro}>Las versiones activas y retiradas se conservan como histórico y no pueden modificarse.</p><ContractTemplateManager agencySlug={agency.agency.agencySlug} templates={settings.templates} /></section>
  </main></AdminShell>;
}
