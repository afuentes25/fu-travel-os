import { unstable_noStore as noStore } from "next/cache";

import styles from "../cuenta.module.css";
import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext } from "../customer-utils";
import { CustomerRegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";
export default async function CustomerRegistrationPage({ searchParams }: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) { noStore(); const params = await searchParams; const next = safeCustomerNext(params.next); const returnTo = safeCustomerAuthReturnTo(params.returnTo); const claim = params.claim === "1" && Boolean(parseCustomerReservationClaimNext(next)); return <main className={styles.loginPage}><section className={styles.loginCard}><div className={styles.kicker}>FU TRAVEL OS · MI CUENTA</div><h1>Crea tu cuenta</h1><p>Administra todas tus reservaciones desde un solo lugar.</p>{(claim || returnTo) && <p className={styles.authContext}>Usa el mismo correo que registraste en tu reservación para continuar.</p>}<CustomerRegistrationForm next={next} returnTo={returnTo} claim={claim}/></section></main>; }
