function validAuthOrigin(value: string | null | undefined, production: boolean) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (production && (url.protocol !== "https:" || local)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Password fallback links still need a callback URL. In production this is
 * fail-closed: only the explicitly configured public site may receive Auth
 * links, never a request-controlled host or localhost.
 */
export function resolveCustomerAuthSiteOrigin(input: Readonly<{
  configuredSiteUrl?: string | null;
  requestOrigin?: string | null;
  production?: boolean;
}>) {
  const production = input.production ?? process.env.NODE_ENV === "production";
  if (production) return validAuthOrigin(input.configuredSiteUrl, true);
  return validAuthOrigin(input.configuredSiteUrl, false)
    ?? validAuthOrigin(input.requestOrigin, false)
    ?? "http://localhost:3000";
}
