import { normalizeCustomerEmail } from "./customer-email";
import { normalizeCustomerProfileInput, type CustomerProfileInput, type CustomerProfileUpdate } from "./customer-profile-core";

export const CUSTOMER_OTP_RESEND_COOLDOWN_SECONDS = 60;

export type CustomerOtpStep =
  | "email"
  | "sending_code"
  | "code_sent"
  | "verifying"
  | "profile_required"
  | "authenticated"
  | "rate_limited"
  | "error";

export type CustomerOtpSendResult =
  | Readonly<{ status: "code_sent" }>
  | Readonly<{ status: "rate_limited" }>
  | Readonly<{ status: "invalid_email" | "error" }>;

export type CustomerOtpVerificationResult =
  | Readonly<{ status: "authenticated"; destination: string | null }>
  | Readonly<{ status: "profile_required"; email: string }>
  | Readonly<{ status: "invalid_code" | "rate_limited" | "error" }>;

export type CustomerOtpProfileResult =
  | Readonly<{ status: "authenticated"; destination: string | null }>
  | Readonly<{ status: "invalid_profile" | "account_unavailable" | "error" }>;

/** The browser may retain this only in component memory while verifying. */
export function validateCustomerOtpEmail(value: unknown) {
  return normalizeCustomerEmail(value);
}

/** Supabase email OTPs are short, single-use strings. The exact value is never logged or persisted by the app. */
export function validateCustomerOtpToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[0-9A-Za-z]{6,12}$/.test(token) ? token : null;
}

export function normalizeVerifiedCustomerProfile(input: CustomerProfileInput): CustomerProfileUpdate | null {
  return normalizeCustomerProfileInput(input);
}

export function resetCustomerOtpDraft() {
  return { email: "", token: "", cooldown: 0, step: "email" as const };
}
