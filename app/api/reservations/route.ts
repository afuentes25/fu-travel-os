import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  executeReservationServerCommand,
  ReservationServerCommandError,
  type AtomicReservationServerCommandInput,
  type AtomicReservationServerCommandResult,
} from "@/lib/reservations/server-command";
import {
  ReservationSnapshotConflictError,
  type ReservationSnapshot,
} from "@/lib/reservations";
import { AtomicReservationPersistenceError } from "@/lib/reservations/atomic-customer-access-core";

const primaryContactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).nullable(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).nullable(),
}).strict();

export const runtime = "nodejs";

const travelerDraftSchema = z
  .object({
    id: z.string().trim().min(1),
    category: z.enum(["adult", "minor"]),
    sequence: z.number().int().positive(),
    fullName: z.string(),
    birthDate: z.string().optional(),
    age: z.number().int().nonnegative().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    completionStatus: z.enum(["complete", "pending"]),
  })
  .strict();

const reservationRequestSchema = z
  .object({
    tenantSlug: z.string().trim().min(1),
    tripId: z.string().trim().min(1).optional(),
    tripCode: z.string().trim().min(1).optional(),
    departureId: z.string().trim().min(1),
    adults: z.number().int().positive(),
    minors: z.number().int().nonnegative(),
    rooms: z.number().int().nonnegative(),
    extraIds: z.array(z.string().trim().min(1)),
    boardingPointId: z.string().trim().min(1),
    depositPercent: z.number().int().min(1).max(100),
    primaryContact: primaryContactSchema.optional(),
    travelers: z
      .object({
        status: z.enum(["complete", "pending"]),
        drafts: z.array(travelerDraftSchema),
      })
      .strict(),
  })
  .strict()
  .refine((input) => input.tripId || input.tripCode, {
    message: "Se requiere un viaje.",
  });

type ReservationCommand = (
  input: AtomicReservationServerCommandInput,
) => Promise<AtomicReservationServerCommandResult>;

type ReservationRouteDependencies = Readonly<{
  execute: ReservationCommand;
  resolveVerifiedAuthUserId?: () => Promise<string | null>;
  revalidateLinkedReservation?: (input: Readonly<{
    agencySlug: string;
    reservationRowId: string;
  }>) => Promise<void>;
}>;

export type ReservationCustomerLinkStatus =
  | "linked"
  | "already_linked"
  | "email_mismatch"
  | "not_authenticated";

const noStoreHeaders = { "Cache-Control": "no-store" };

function response(body: unknown, status: number) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

function confirmationFromSnapshot(snapshot: ReservationSnapshot) {
  return {
    tripCode: snapshot.tour.code,
    tripName: snapshot.tour.title,
    departureDate: snapshot.departure.startDate,
    boardingPointName: snapshot.boarding.pointName,
    rooms: snapshot.rooms,
    occupancy: {
      adults: snapshot.occupancy.adults,
      minors: snapshot.occupancy.minors,
      totalTravelers: snapshot.occupancy.totalTravelers,
    },
    currency: snapshot.currency,
    total: snapshot.total,
    depositPercent: snapshot.depositPercent,
    depositAmount: snapshot.depositAmount,
    remainingAmount: snapshot.remainingAmount,
  };
}

export function createReservationPostHandler(
  dependencies: ReservationRouteDependencies = {
    execute: executeReservationServerCommand,
    resolveVerifiedAuthUserId: async () => {
      const [{ createSupabaseAuthServerClient }, { resolveVerifiedSupabaseIdentity }] =
        await Promise.all([
          import("@/lib/supabase/auth-server"),
          import("@/lib/supabase/auth-identity-core"),
        ]);
      const identity = await resolveVerifiedSupabaseIdentity(
        await createSupabaseAuthServerClient(),
      );
      return identity?.userId ?? null;
    },
    revalidateLinkedReservation: async ({ agencySlug, reservationRowId }) => {
      const { revalidatePath } = await import("next/cache");
      const slug = encodeURIComponent(agencySlug);
      const reservationId = encodeURIComponent(reservationRowId);
      revalidatePath("/cuenta", "layout");
      revalidatePath(`/cuenta/${slug}/reservaciones`, "layout");
      revalidatePath(`/cuenta/${slug}/reservaciones/${reservationId}`);
      revalidatePath(`/admin/${slug}/reservaciones/${reservationId}`);
    },
  },
) {
  return async function postReservation(request: Request) {
    const requestId = randomUUID();
    if (request.method !== "POST") {
      return response({ error: "Método no permitido." }, 405);
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return response({ error: "El contenido debe ser JSON." }, 400);
    }
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return response({ error: "Falta Idempotency-Key." }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return response({ error: "JSON inválido." }, 400);
    }
    const parsed = reservationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return response({ error: "La entrada de reservación no es válida." }, 400);
    }

    try {
      let verifiedAuthUserId: string | null;
      try {
        verifiedAuthUserId = dependencies.resolveVerifiedAuthUserId
          ? await dependencies.resolveVerifiedAuthUserId()
          : null;
      } catch {
        console.error("reservation_create_failed", {
          event: "auth_identity_failed",
          requestId,
        });
        return response({ error: "No fue posible validar la sesión." }, 500);
      }

      const result = await dependencies.execute({
        ...parsed.data,
        idempotencyKey,
        verifiedAuthUserId,
      });
      const customerLinkStatus: ReservationCustomerLinkStatus =
        result.customerLinkStatus;
      if (
        (customerLinkStatus === "linked" ||
          customerLinkStatus === "already_linked") &&
        dependencies.revalidateLinkedReservation
      ) {
        await dependencies.revalidateLinkedReservation({
          agencySlug: parsed.data.tenantSlug,
          reservationRowId: result.reservation.id,
        });
      }
      return response(
        {
          reservationId: result.reservation.id,
          reservationCode: result.reservation.reservationCode,
          status: result.reservation.status,
          createdAt: result.reservation.createdAt,
          confirmation: confirmationFromSnapshot(result.reservation),
          ...(parsed.data.primaryContact ? { customerLinkStatus } : {}),
        },
        201,
      );
    } catch (error) {
      if (error instanceof ReservationServerCommandError) {
        return response(
          { error: error.message },
          error.kind === "not_found" ? 404 : 400,
        );
      }
      if (error instanceof ReservationSnapshotConflictError) {
        return response({ error: error.message }, 409);
      }
      if (error instanceof AtomicReservationPersistenceError) {
        console.error("reservation_create_failed", {
          event: error.event,
          requestId,
        });
        return response({ error: error.message }, 500);
      }
      console.error("reservation_create_failed", {
        event: "reservation_create_failed",
        requestId,
      });
      return response({ error: "No fue posible registrar la reservación." }, 500);
    }
  };
}

export const POST = createReservationPostHandler();
