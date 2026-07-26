import type { Agency, AgencySocialLink, SocialNetwork } from "@/types";

export const supportedSocialNetworks: readonly SocialNetwork[] = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "x",
  "whatsapp",
];

export function isValidSocialUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function getAgencySocialLinks(
  agency: Agency,
  placement: "header" | "footer",
): AgencySocialLink[] {
  return (agency.settings.socialSettings?.links ?? [])
    .filter((link) =>
      link.enabled &&
      supportedSocialNetworks.includes(link.network) &&
      isValidSocialUrl(link.url) &&
      (placement === "header" ? link.showInHeader : link.showInFooter),
    )
    .sort((a, b) => a.order - b.order);
}
