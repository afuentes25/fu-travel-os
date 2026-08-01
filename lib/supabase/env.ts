export type SupabaseServerEnvironment = {
  url: string;
  serviceRoleKey: string;
};

const SUPABASE_ENVIRONMENT_ERROR =
  "La configuración de Supabase del servidor no está disponible.";

/**
 * Reads server-only Supabase credentials lazily so local builds and client
 * bundles never require or expose them.
 */
export function getSupabaseServerEnvironment(): SupabaseServerEnvironment {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(SUPABASE_ENVIRONMENT_ERROR);
  }

  try {
    new URL(url);
  } catch {
    throw new Error(SUPABASE_ENVIRONMENT_ERROR);
  }

  return { url, serviceRoleKey };
}
