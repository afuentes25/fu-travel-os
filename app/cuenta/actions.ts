"use server";

import { redirect } from "next/navigation";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { safeCustomerNext, validateCustomerLoginCredentials } from "./customer-utils";
import type { CustomerLoginState } from "./login/login-state";

function loginError(): CustomerLoginState {
  return { error: "No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente." };
}

export async function loginCustomerAction(
  _previous: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  const credentials = validateCustomerLoginCredentials({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeCustomerNext(formData.get("next"));
  if (!credentials) return loginError();

  let access: Awaited<ReturnType<typeof resolveCustomerAgencyAccess>>;
  try {
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.signInWithPassword(credentials);
    if (error) return loginError();
    access = await resolveCustomerAgencyAccess();
  } catch {
    return loginError();
  }

  if (access.status === "authorized") {
    const agencyPath = `/cuenta/${encodeURIComponent(access.account.agencySlug)}/reservaciones`;
    redirect(next?.startsWith(`${agencyPath}/`) || next === agencyPath ? next : agencyPath);
  }
  if (access.status === "selection_required") redirect("/cuenta");
  return { error: "No tienes acceso activo como cliente." };
}

export async function logoutCustomerAction() {
  const auth = await createSupabaseAuthServerClient();
  await auth.auth.signOut();
  redirect("/cuenta/login");
}
