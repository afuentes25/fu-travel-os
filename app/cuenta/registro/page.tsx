import { unstable_noStore as noStore } from "next/cache";

import styles from "../cuenta.module.css";
import { parseCustomerReservationClaimNext, safeCustomerNext } from "../customer-utils";
import { CustomerRegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";
export default async function CustomerRegistrationPage({ searchParams }: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) { noStore(); const params = await searchParams; const next = safeCustomerNext(params.next); const claim = params.claim === "1" && Boolean(parseCustomerReservationClaimNext(next)); return <main className={styles.loginPage}><section className={styles.loginCard}><div className={styles.kicker}>FU TRAVEL OS</div><h1>Crear tu cuenta</h1><p>Usa el mismo correo que registraste en tu reservación.</p><CustomerRegistrationForm next={next} claim={claim}/></section></main>; }
