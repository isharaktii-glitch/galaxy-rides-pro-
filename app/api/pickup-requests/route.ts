import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validId(value: string | null): boolean {
  return !!value && /^[1-9]\d*$/.test(value);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// GET: Load pickup requests for a driver.
export async function GET(request: NextRequest) {
  try {
    const driverId = request.nextUrl.searchParams.get("driverId");

    if (!validId(driverId)) {
      return jsonError("A valid driverId is required.", 400);
    }

    const sql = getDatabase();

    const driver = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId}
        AND role = 'Driver'
      LIMIT 1
    `;

    if (!driver.length) {
      return jsonError("Driver account not found.", 404);
    }

    const requests = await sql`
      SELECT
        pr.id,
        pr.ride_id AS "rideId",
        pr.passenger_id AS "passengerId",
        pr.status,
        pr.created_at AS "createdAt",
        u.full_name AS "passengerName",
        u.phone AS "passengerPhone",
        r.start_location AS "startLocation",
        r.end_location AS "endLocation",
        r.fare_lkr AS "fareLkr"
      FROM pickup_requests pr
      JOIN rides r ON r.id = pr.ride_id
      JOIN users u ON u.id = pr.passenger_id
      WHERE r.driver_id = ${driverId}
      ORDER BY pr.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ requests });
  } catch (error) {
    console.error(
      "Load pickup requests failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError("Unable to load pickup requests.", 503);
  }
}

// POST: Passenger requests a pickup.
export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must contain valid JSON.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request.", 400);
    }

    const data = body as Record<string, unknown>;
    const rideId = String(data.rideId ?? "");
    const passengerId = String(data.passengerId ?? "");

    if (
      !/^[1-9]\d*$/.test(rideId) ||
      !/^[1-9]\d*$/.test(passengerId)
    ) {
      return jsonError("Valid ride and passenger IDs are required.", 400);
    }

    const sql = getDatabase();

    const passenger = await sql`
      SELECT id
      FROM users
      WHERE id = ${passengerId}
        AND role = 'Passenger'
      LIMIT 1
    `;

    if (!passenger.length) {
      return jsonError("Passenger account not found.", 404);
    }

    const ride = await sql`
      SELECT id
      FROM rides
      WHERE id = ${rideId}
        AND status IN ('SCHEDULED', 'IN PROGRESS')
      LIMIT 1
    `;

    if (!ride.length) {
      return jsonError("This ride is no longer available.", 404);
    }

    const existing = await sql`
      SELECT id, status
      FROM pickup_requests
      WHERE ride_id = ${rideId}
        AND passenger_id = ${passengerId}
      LIMIT 1
    `;

    if (existing.length) {
      return NextResponse.json(
        {
          error: "You have already requested this ride.",
          request: existing[0]
        },
        { status: 409 }
      );
    }

    const created = await sql`
      INSERT INTO pickup_requests (
        ride_id,
        passenger_id,
        status
      )
      VALUES (${rideId}, ${passengerId}, 'PENDING')
      RETURNING
        id,
        ride_id AS "rideId",
        passenger_id AS "passengerId",
        status,
        created_at AS "createdAt"
    `;

    return NextResponse.json(
      { request: created[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create pickup request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError(
      "Unable to create pickup request. The database may reject the PENDING status.",
      503
    );
  }
}

// PATCH: Driver accepts or rejects a pickup request.
export async function PATCH(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must contain valid JSON.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request.", 400);
    }

    const data = body as Record<string, unknown>;
    const requestId = String(data.requestId ?? "");
    const driverId = String(data.driverId ?? "");
    const action = String(data.action ?? "").toUpperCase();

    if (
      !/^[1-9]\d*$/.test(requestId) ||
      !/^[1-9]\d*$/.test(driverId) ||
      !["ACCEPTED", "REJECTED"].includes(action)
    ) {
      return jsonError(
        "Valid IDs and ACCEPTED or REJECTED action are required.",
        400
      );
    }

    const sql = getDatabase();

    const driver = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId}
        AND role = 'Driver'
      LIMIT 1
    `;

    if (!driver.length) {
      return jsonError("Driver account not found.", 404);
    }

    const updated = await sql`
      UPDATE pickup_requests AS pr
      SET status = ${action}
      FROM rides AS r
      WHERE pr.id = ${requestId}
        AND pr.ride_id = r.id
        AND r.driver_id = ${driverId}
        AND UPPER(pr.status) = 'PENDING'
      RETURNING
        pr.id,
        pr.ride_id AS "rideId",
        pr.passenger_id AS "passengerId",
        pr.status
    `;

    if (!updated.length) {
      return jsonError(
        "Request not found, already processed, or not assigned to this driver.",
        409
      );
    }

    return NextResponse.json({ request: updated[0] });
  } catch (error) {
    console.error(
      "Update pickup request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return jsonError(
      "Unable to update the request. The database may not allow this status.",
      503
    );
  }
}
