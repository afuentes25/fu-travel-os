const INTERNAL_PREFIXES = ["/admin", "/api", "/_next"] as const;
const STATIC_ASSET_PATTERN =
  /^\/(?:favicon\.ico|icon\.png|apple-icon\.png|robots\.txt|sitemap\.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico))$/i;

/** Routes that must never fall through to the public tenant renderer. */
export function isReservedInternalPath(pathname: string) {
  return (
    INTERNAL_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) || STATIC_ASSET_PATTERN.test(pathname)
  );
}
