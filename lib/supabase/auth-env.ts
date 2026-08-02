export type SupabasePublicEnvironment = Readonly<{
  url: string;
  publishableKey: string;
}>;

const SUPABASE_PUBLIC_ENVIRONMENT_ERROR =
  "La configuración pública de autenticación no está disponible.";

/** Reads only browser-safe Supabase configuration, lazily. */
export function getSupabasePublicEnvironment(): SupabasePublicEnvironment {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(SUPABASE_PUBLIC_ENVIRONMENT_ERROR);
  }

  try {
    new URL(url);
  } catch {
    throw new Error(SUPABASE_PUBLIC_ENVIRONMENT_ERROR);
  }

  return { url, publishableKey };
}
