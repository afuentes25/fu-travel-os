"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  boardBoardingTraveler,
  checkInBoardingTraveler,
  resolveBoardingScan,
} from "@/lib/boarding/boarding-scan";

export async function resolveBoardingScanAction(input: Readonly<{ agencySlug: string; rawToken: string }>) {
  const result = await resolveBoardingScan({ requestedAgencySlug: input.agencySlug, rawToken: input.rawToken });
  if (result.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${input.agencySlug}/abordaje`)}`);
  if (result.status === "selection_required") redirect("/admin");
  return result;
}

export async function checkInBoardingTravelerAction(input: Readonly<{ agencySlug: string; rawToken: string }>) {
  const transition = await checkInBoardingTraveler({ requestedAgencySlug: input.agencySlug, rawToken: input.rawToken });
  if (transition.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${input.agencySlug}/abordaje`)}`);
  if (transition.status === "selection_required") redirect("/admin");
  if (transition.status === "checked_in" || transition.status === "already_checked_in" || transition.status === "already_boarded") {
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/abordaje`);
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/reservaciones`, "layout");
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/salidas`, "layout");
    return { transition, scan: await resolveBoardingScan({ requestedAgencySlug: input.agencySlug, rawToken: input.rawToken }) };
  }
  return { transition };
}

export async function boardBoardingTravelerAction(input: Readonly<{ agencySlug: string; rawToken: string }>) {
  const transition = await boardBoardingTraveler({ requestedAgencySlug: input.agencySlug, rawToken: input.rawToken });
  if (transition.status === "unauthenticated") redirect(`/admin/login?next=${encodeURIComponent(`/admin/${input.agencySlug}/abordaje`)}`);
  if (transition.status === "selection_required") redirect("/admin");
  if (transition.status === "boarded" || transition.status === "already_boarded") {
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/abordaje`);
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/reservaciones`, "layout");
    revalidatePath(`/admin/${encodeURIComponent(input.agencySlug)}/salidas`, "layout");
    return { transition, scan: await resolveBoardingScan({ requestedAgencySlug: input.agencySlug, rawToken: input.rawToken }) };
  }
  return { transition };
}
