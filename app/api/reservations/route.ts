import { z } from "zod";

import {
  executeReservationServerCommand,
  ReservationServerCommandError,
  type ReservationServerCommandInput,
} from "@/lib/reservations/server-command";
import { ReservationSnapshotConflictError } from "@/lib/reservations";

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
  input: ReservationServerCommandInput,
) => Promise<{
  reservation: {
    id: string;
    reservationCode: string;
    status: string;
    createdAt: string;
  };
  created: boolean;
}>;

type ReservationRouteDependencies = Readonly<{
  execute: ReservationCommand;
}>;

const noStoreHeaders = { "Cache-Control": "no-store" };

function response(body: Record<string, string>, status: number) {
  return Response.json(body, { status, headers: noStoreHeaders });
}

export function createReservationPostHandler(
  dependencies: ReservationRouteDependencies = {
    execute: executeReservationServerCommand,
  },
) {
  return async function postReservation(request: Request) {
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
      const result = await dependencies.execute({
        ...parsed.data,
        idempotencyKey,
      });
      return response(
        {
          reservationId: result.reservation.id,
          reservationCode: result.reservation.reservationCode,
          status: result.reservation.status,
          createdAt: result.reservation.createdAt,
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
      return response({ error: "No fue posible registrar la reservación." }, 500);
    }
  };
}

export const POST = createReservationPostHandler();
