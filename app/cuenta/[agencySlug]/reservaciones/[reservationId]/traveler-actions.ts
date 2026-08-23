"use server";

import { revalidatePath } from "next/cache";

import { saveReservationTravelerData } from "@/lib/travelers/traveler-data";

export type TravelerDataFormState = Readonly<{
  success?: string;
  error?: string;
  errors?: Readonly<{
    firstName?: string;
    lastName?: string;
    birthDate?: string;
  }>;
  values?: Readonly<{
    firstName: string;
    lastName: string;
    birthDate: string;
  }>;
}>;

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveTravelerDataAction(
  _previous: TravelerDataFormState,
  formData: FormData,
): Promise<TravelerDataFormState> {
  const requestedAgencySlug = fieldValue(formData, "requestedAgencySlug");
  const reservationId = fieldValue(formData, "reservationId");
  const position = Number(fieldValue(formData, "position"));
  const values = {
    firstName: fieldValue(formData, "firstName"),
    lastName: fieldValue(formData, "lastName"),
    birthDate: fieldValue(formData, "birthDate"),
  };

  try {
    const result = await saveReservationTravelerData({
      requestedAgencySlug,
      reservationId,
      position,
      ...values,
    });
    if (result.status === "invalid") {
      const { position: _position, ...errors } = result.errors;
      return Object.keys(errors).length
        ? { errors, values }
        : { error: "No fue posible guardar los datos. Inténtalo nuevamente.", values };
    }
    if (result.status !== "saved") {
      return { error: "No fue posible guardar los datos. Inténtalo nuevamente.", values };
    }

    revalidatePath(
      `/cuenta/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`,
    );
    revalidatePath(
      `/admin/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`,
    );
    revalidatePath(`/admin/${encodeURIComponent(requestedAgencySlug)}/salidas`, "layout");
    return { success: "Datos guardados correctamente." };
  } catch {
    return { error: "No fue posible guardar los datos. Inténtalo nuevamente.", values };
  }
}
