import type { BookingStatus } from "@/types";

export const ADMIN_RESERVATION_STATUSES = [
  "pending",
  "deposit_pending",
  "partially_paid",
  "confirmed",
  "cancelled",
  "refunded",
  "completed",
] as const satisfies readonly BookingStatus[];

export type AdminReservationStatusFilter = (typeof ADMIN_RESERVATION_STATUSES)[number];

export type AdminLoginCredentials = {
  email: string;
  password: string;
};

export function safeAdminNext(value: unknown): string | null {
  if (typeof value !== "string" || value.includes("\\")) return null;
  if (!(value === "/admin" || value.startsWith("/admin/"))) return null;

  try {
    const url = new URL(value, "https://admin.invalid");
    if (url.origin !== "https://admin.invalid") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function validateAdminLoginCredentials(input: {
  email: unknown;
  password: unknown;
}): AdminLoginCredentials | null {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return null;
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return null;
  }

  return { email, password };
}

export function parseAdminReservationStatus(
  value: unknown,
): AdminReservationStatusFilter | undefined {
  return typeof value === "string" &&
    (ADMIN_RESERVATION_STATUSES as readonly string[]).includes(value)
    ? (value as AdminReservationStatusFilter)
    : undefined;
}

export function parseAdminReservationPage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function adminReservationHref(
  agencySlug: string,
  status: AdminReservationStatusFilter | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/admin/${encodeURIComponent(agencySlug)}/reservaciones${search ? `?${search}` : ""}`;
}

export function adminRoleLabel(role: "owner" | "admin" | "staff") {
  return {
    owner: "Propietario",
    admin: "Administrador",
    staff: "Personal",
  }[role];
}

export function adminReservationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    partially_paid: "Anticipo pagado",
    paid: "Pagada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? `Estado: ${status.replace(/[_-]+/g, " ")}`;
}
