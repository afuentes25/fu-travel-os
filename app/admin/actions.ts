"use server";

import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { safeAdminNext, validateAdminLoginCredentials } from "./admin-utils";
import type { AdminLoginState } from "./login/login-state";

function loginError(): AdminLoginState {
  return { error: "No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente." };
}

export async function loginAdminAction(
  _previous: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const credentials = validateAdminLoginCredentials({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeAdminNext(formData.get("next"));
  if (!credentials) return loginError();

  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;

  try {
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) return loginError();
    access = await resolveAdminAgencyAccess();
  } catch {
    return loginError();
  }

  if (access.status === "authorized") {
    const agencyPath = `/admin/${encodeURIComponent(access.agency.agencySlug)}/reservaciones`;
    redirect(next?.startsWith(`${agencyPath}/`) || next === agencyPath ? next : agencyPath);
  }
  if (access.status === "selection_required") redirect("/admin");
  return { error: "Tu cuenta no tiene acceso administrativo activo." };
}

export async function logoutAdminAction() {
  const auth = await createSupabaseAuthServerClient();
  await auth.auth.signOut();
  redirect("/admin/login");
}
